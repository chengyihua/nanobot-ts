/**
 * 智能文档读取助手
 * 基于Vercel研究的文档索引模式
 */

import fs from 'fs';
import path from 'path';

class DocIndexHelper {
  constructor(indexPath = '/workspace/DOC_INDEX.md') {
    this.indexPath = indexPath;
    this.index = null;
    this.loadIndex();
  }

  // 加载索引文件
  loadIndex() {
    try {
      const content = fs.readFileSync(this.indexPath, 'utf8');
      this.index = this.parseIndex(content);
      console.log(`✅ 文档索引加载成功，共 ${this.index.length} 个条目`);
    } catch (error) {
      console.error('❌ 加载索引失败:', error.message);
      this.index = [];
    }
  }

  // 解析索引内容
  parseIndex(content) {
    const entries = [];
    const lines = content.split('\n');
    
    let currentSection = '';
    
    for (const line of lines) {
      // 跳过空行和注释
      if (!line.trim() || line.trim().startsWith('#')) {
        // 检查是否是章节标题
        if (line.trim().startsWith('## ')) {
          currentSection = line.trim().replace('## ', '');
        }
        continue;
      }

      // 解析索引条目（格式：关键词|路径|描述）
      const parts = line.split('|');
      if (parts.length >= 2) {
        const keyword = parts[0].trim();
        const filePath = parts[1].trim();
        const description = parts.length >= 3 ? parts[2].trim() : '';
        
        entries.push({
          keyword,
          filePath,
          description,
          section: currentSection
        });
      }
    }
    
    return entries;
  }

  // 搜索关键词
  search(keyword) {
    if (!this.index || this.index.length === 0) {
      return [];
    }

    const lowerKeyword = keyword.toLowerCase();
    return this.index.filter(entry => 
      entry.keyword.toLowerCase().includes(lowerKeyword) ||
      entry.description.toLowerCase().includes(lowerKeyword) ||
      entry.section.toLowerCase().includes(lowerKeyword)
    );
  }

  // 读取文档内容
  readDocument(filePath, maxLines = 100) {
    try {
      // 处理锚点（#section）
      let actualPath = filePath;
      let anchor = '';
      
      const anchorIndex = filePath.indexOf('#');
      if (anchorIndex > -1) {
        actualPath = filePath.substring(0, anchorIndex);
        anchor = filePath.substring(anchorIndex + 1);
      }

      // 确保路径在workspace内
      if (!actualPath.startsWith('/workspace/') && !actualPath.startsWith('skills/')) {
        actualPath = path.join('/workspace', actualPath);
      }

      const content = fs.readFileSync(actualPath, 'utf8');
      
      // 如果有锚点，提取相关部分
      if (anchor) {
        return this.extractSection(content, anchor, maxLines);
      }
      
      // 否则返回前N行
      return content.split('\n').slice(0, maxLines).join('\n');
      
    } catch (error) {
      return `❌ 读取文档失败: ${error.message}\n路径: ${filePath}`;
    }
  }

  // 提取特定章节
  extractSection(content, anchor, maxLines) {
    const lines = content.split('\n');
    let inSection = false;
    let sectionLines = [];
    let sectionLevel = 0;

    for (const line of lines) {
      // 检查是否是标题行
      if (line.startsWith('#')) {
        const match = line.match(/^(#+)\s+(.+)/);
        if (match) {
          const level = match[1].length;
          const title = match[2].toLowerCase().replace(/[^a-z0-9]/g, '-');
          
          if (title.includes(anchor.toLowerCase())) {
            inSection = true;
            sectionLevel = level;
            sectionLines.push(line);
          } else if (inSection && level <= sectionLevel) {
            // 遇到同级或更高级标题，结束当前章节
            break;
          }
        }
      } else if (inSection) {
        sectionLines.push(line);
        
        // 限制行数
        if (sectionLines.length >= maxLines) {
          sectionLines.push('...（内容截断）');
          break;
        }
      }
    }

    return sectionLines.length > 0 ? sectionLines.join('\n') : '未找到指定章节';
  }

  // 获取文档摘要
  getDocumentSummary(filePath) {
    const content = this.readDocument(filePath, 20);
    const lines = content.split('\n');
    
    // 提取前几行作为摘要
    let summary = '';
    for (const line of lines) {
      if (line.trim() && !line.startsWith('#') && summary.length < 200) {
        summary += line + ' ';
      }
    }
    
    return summary.trim() || '无摘要可用';
  }

  // 智能回答：根据问题查找相关文档
  async answerQuestion(question) {
    console.log(`🔍 搜索问题: "${question}"`);
    
    // 搜索相关条目
    const results = this.search(question);
    
    if (results.length === 0) {
      return {
        found: false,
        message: '未找到相关文档',
        suggestions: this.index.slice(0, 5).map(e => e.keyword)
      };
    }

    // 读取最相关的前3个文档
    const docs = [];
    for (let i = 0; i < Math.min(3, results.length); i++) {
      const entry = results[i];
      const content = this.readDocument(entry.filePath, 50);
      
      docs.push({
        keyword: entry.keyword,
        filePath: entry.filePath,
        description: entry.description,
        content: content,
        summary: this.getDocumentSummary(entry.filePath)
      });
    }

    return {
      found: true,
      question: question,
      results: docs,
      totalMatches: results.length
    };
  }
}

// 使用示例
if (require.main === module) {
  const helper = new DocIndexHelper();
  
  // 测试搜索
  const testQueries = ['语音', '文件', '浏览器', '邮件'];
  
  testQueries.forEach(query => {
    console.log(`\n=== 测试搜索: "${query}" ===`);
    const results = helper.search(query);
    
    if (results.length > 0) {
      console.log(`找到 ${results.length} 个结果:`);
      results.slice(0, 3).forEach((result, i) => {
        console.log(`${i+1}. ${result.keyword} - ${result.description}`);
      });
    } else {
      console.log('未找到结果');
    }
  });
}

module.exports = DocIndexHelper;