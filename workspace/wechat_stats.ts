// 微信公众号文章数据统计脚本
import https from "node:https";

const APP_ID = "wx15d2fab24534d34b";
const APP_SECRET = "6cb2b71ff8cc152814f407c58889e3e9";

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

interface ArticleReadResponse {
  list?: Array<{
    ref_date: string;
    msgid: string;
    title: string;
    int_page_read_user: number;  // 图文页阅读人数
    int_page_read_count: number; // 图文页阅读次数
    ori_page_read_user: number;  // 原文页阅读人数
    ori_page_read_count: number; // 原文页阅读次数
    share_user: number;          // 分享人数
    share_count: number;         // 分享次数
    add_to_fav_user: number;     // 收藏人数
    add_to_fav_count: number;    // 收藏次数
  }>;
  errcode?: number;
  errmsg?: string;
}

interface SummaryResponse {
  ref_date: string;
  articles_added: number;        // 新增文章数
  total_read_user: number;       // 总阅读人数
  total_read_count: number;      // 总阅读次数
  total_share_user: number;      // 总分享人数
  total_share_count: number;     // 总分享次数
  errcode?: number;
  errmsg?: string;
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function httpsPost(url: string, body: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(body);
    
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };
    
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
      res.on("error", reject);
    });
    
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function getAccessToken(): Promise<string> {
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APP_ID}&secret=${APP_SECRET}`;
  const response = await httpsGet(url);
  const data: TokenResponse = JSON.parse(response);
  
  if (data.errcode) {
    throw new Error(`获取access_token失败: ${data.errmsg} (${data.errcode})`);
  }
  
  return data.access_token!;
}

// 获取文章每日阅读数据
async function getArticleRead(accessToken: string, beginDate: string, endDate: string): Promise<ArticleReadResponse> {
  const url = `https://api.weixin.qq.com/datacube/getarticleread?access_token=${accessToken}`;
  const response = await httpsPost(url, { begin_date: beginDate, end_date: endDate });
  return JSON.parse(response);
}

// 获取发表内容概况
async function getBizSummary(accessToken: string, beginDate: string, endDate: string): Promise<SummaryResponse> {
  const url = `https://api.weixin.qq.com/datacube/getbizsummary?access_token=${accessToken}`;
  const response = await httpsPost(url, { begin_date: beginDate, end_date: endDate });
  return JSON.parse(response);
}

// 获取已发布文章列表
async function getArticles(accessToken: string, offset: number = 0, count: number = 10): Promise<any> {
  const url = `https://api.weixin.qq.com/cgi-bin/freepublish/batchget?access_token=${accessToken}`;
  const response = await httpsPost(url, { offset, count, no_content: 0 });
  return JSON.parse(response);
}

async function main() {
  console.log("=== 微信公众号数据统计 ===\n");
  
  // 1. 获取 access_token
  console.log("正在获取 access_token...");
  const accessToken = await getAccessToken();
  console.log("✓ access_token 获取成功\n");
  
  // 2. 获取已发布文章列表
  console.log("正在获取已发布文章列表...");
  const articlesData = await getArticles(accessToken, 0, 20);
  
  if (articlesData.errcode) {
    console.error(`获取文章列表失败: ${articlesData.errmsg} (${articlesData.errcode})`);
  } else {
    console.log(`✓ 共有 ${articlesData.total_count} 篇已发布文章\n`);
    
    if (articlesData.item && articlesData.item.length > 0) {
      console.log("--- 已发布文章 ---");
      articlesData.item.forEach((item: any, index: number) => {
        const article = item.content?.news_item?.[0];
        if (article) {
          console.log(`${index + 1}. ${article.title}`);
          console.log(`   发布时间: ${new Date(item.update_time * 1000).toLocaleString("zh-CN")}`);
          console.log(`   文章ID: ${item.article_id}`);
        }
      });
      console.log("");
    }
  }
  
  // 3. 获取最近7天的阅读数据
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const formatDate = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  
  const beginDate = formatDate(sevenDaysAgo);
  const endDate = formatDate(today);
  
  console.log(`正在获取 ${beginDate} 到 ${endDate} 的阅读数据...`);
  
  const readData = await getArticleRead(accessToken, beginDate, endDate);
  
  if (readData.errcode) {
    console.error(`获取阅读数据失败: ${readData.errmsg} (${readData.errcode})`);
    console.log("\n注意: 可能是因为没有阅读数据，或者API需要认证服务号才能使用");
  } else if (readData.list && readData.list.length > 0) {
    console.log(`✓ 找到 ${readData.list.length} 条阅读记录\n`);
    console.log("--- 文章阅读数据 ---");
    
    let totalRead = 0;
    let totalShare = 0;
    
    readData.list.forEach((item, index) => {
      console.log(`\n${index + 1}. ${item.title}`);
      console.log(`   日期: ${item.ref_date}`);
      console.log(`   图文页阅读: ${item.int_page_read_user}人 / ${item.int_page_read_count}次`);
      console.log(`   原文页阅读: ${item.ori_page_read_user}人 / ${item.ori_page_read_count}次`);
      console.log(`   分享: ${item.share_user}人 / ${item.share_count}次`);
      console.log(`   收藏: ${item.add_to_fav_user}人 / ${item.add_to_fav_count}次`);
      
      totalRead += item.int_page_read_count;
      totalShare += item.share_count;
    });
    
    console.log("\n=== 总计 ===");
    console.log(`总阅读次数: ${totalRead}`);
    console.log(`总分享次数: ${totalShare}`);
  } else {
    console.log("⚠ 没有找到阅读数据");
    console.log("\n可能的原因:");
    console.log("1. 文章发布时间太短，数据还没统计");
    console.log("2. 阅读量太少（需要至少3次阅读才会统计）");
    console.log("3. 需要认证服务号才能使用此API");
  }
  
  // 4. 获取概况数据
  console.log("\n正在获取概况数据...");
  const summaryData = await getBizSummary(accessToken, beginDate, endDate);
  
  if (summaryData.errcode) {
    console.error(`获取概况数据失败: ${summaryData.errmsg} (${summaryData.errcode})`);
  } else {
    console.log("\n--- 概况数据 ---");
    console.log(`日期范围: ${summaryData.ref_date}`);
    console.log(`新增文章: ${summaryData.articles_added} 篇`);
    console.log(`总阅读人数: ${summaryData.total_read_user}`);
    console.log(`总阅读次数: ${summaryData.total_read_count}`);
    console.log(`总分享人数: ${summaryData.total_share_user}`);
    console.log(`总分享次数: ${summaryData.total_share_count}`);
  }
}

main().catch(console.error);
