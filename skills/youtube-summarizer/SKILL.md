---
name: youtube-summarizer
description: Advanced YouTube video summarizer with transcript extraction, chapter analysis, and multi-format output.
homepage: https://github.com/chengyihua/nanobot-ts
metadata: {"nanobot":{"emoji":"🎬","requires":{"bins":["summarize","yt-dlp","ffmpeg"]},"install":[{"id":"summarize","kind":"npm","package":"@steipete/summarize","bins":["summarize"],"label":"Install summarize (npm)"},{"id":"yt-dlp","kind":"brew","formula":"yt-dlp","bins":["yt-dlp"],"label":"Install yt-dlp (brew)"},{"id":"ffmpeg","kind":"brew","formula":"ffmpeg","bins":["ffmpeg"],"label":"Install ffmpeg (brew)"}]}}
---

# YouTube Summarizer

Advanced YouTube video summarization with transcript extraction, chapter analysis, timestamp-based summaries, and multiple output formats.

## When to use (trigger phrases)

Use this skill immediately when the user asks any of:
- "summarize this YouTube video"
- "what's this YouTube video about?"
- "extract transcript from YouTube"
- "get key points from this video"
- "YouTube video summary with timestamps"
- "analyze YouTube video chapters"

## Features

### 1. **Transcript Extraction**
- Extract full transcripts from YouTube videos
- Support for auto-generated and manual captions
- Multiple language support
- Clean formatting with timestamps

### 2. **Intelligent Summarization**
- Extract key points and main ideas
- Generate concise summaries (short/medium/long)
- Identify important sections with timestamps
- Chapter-based analysis when available

### 3. **Multiple Output Formats**
- **Text summary**: Concise text overview
- **Detailed report**: Full analysis with timestamps
- **Bullet points**: Key takeaways in bullet format
- **JSON**: Structured data for programmatic use
- **Markdown**: Formatted markdown with chapters

### 4. **Advanced Features**
- **Chapter extraction**: Analyze video chapters
- **Timestamp linking**: Link summaries to video positions
- **Multi-language**: Support for videos in different languages
- **Batch processing**: Summarize multiple videos
- **Custom prompts**: Tailor summaries to specific needs

## Quick Start

### Basic Usage
```bash
# Summarize a YouTube video
nanobot youtube-summarizer "https://youtu.be/dQw4w9WgXcQ"

# Extract transcript only
nanobot youtube-summarizer "https://youtu.be/dQw4w9WgXcQ" --transcript-only

# Get detailed analysis with timestamps
nanobot youtube-summarizer "https://youtu.be/dQw4w9WgXcQ" --detailed --with-timestamps
```

### Advanced Options
```bash
# Specify summary length
nanobot youtube-summarizer "URL" --length short|medium|long|xl

# Output in specific format
nanobot youtube-summarizer "URL" --format json|markdown|text|bullet

# Include video metadata
nanobot youtube-summarizer "URL" --with-metadata

# Set custom language for transcript
nanobot youtube-summarizer "URL" --language en|zh|ja|ko|es
```

## Examples

### Example 1: Basic Summary
```bash
nanobot youtube-summarizer "https://youtu.be/example123"
```
**Output:**
```
🎬 YouTube Video Summary

Title: How to Build a YouTube Summarizer
Duration: 15:30
Views: 50,000

📝 Summary:
This video explains how to build a YouTube summarizer using AI. The creator demonstrates extracting transcripts, using summarization APIs, and creating a user-friendly interface. Key points include choosing the right AI model, handling different video formats, and optimizing for accuracy.

🔑 Key Takeaways:
• Use yt-dlp for reliable transcript extraction
• Consider using OpenAI or Anthropic for summarization
• Include timestamps for better user experience
• Handle multiple languages gracefully
```

### Example 2: Detailed Analysis with Chapters
```bash
nanobot youtube-summarizer "https://youtu.be/example456" --detailed --with-chapters
```
**Output:**
```
🎬 Detailed YouTube Analysis

📊 Video Information:
• Title: Advanced AI Techniques 2026
• Channel: AI Research Lab
• Duration: 45:15
• Published: 2026-02-13
• Views: 120,450
• Likes: 8,950

📖 Chapters:
1. [00:00-10:30] Introduction to New AI Models
2. [10:31-25:45] Multimodal AI Applications
3. [25:46-35:20] Ethical Considerations
4. [35:21-45:15] Future Predictions

📝 Chapter Summaries:

1. Introduction to New AI Models (00:00-10:30)
   - Overview of GPT-5 and Gemini 3.0 capabilities
   - Comparison of different model architectures
   - Performance benchmarks on standard tests

2. Multimodal AI Applications (10:31-25:45)
   - Video understanding and generation
   - Audio processing advancements
   - Real-world use cases in healthcare and education

... (more chapter summaries)
```

## Configuration

### Required Tools
1. **summarize**: For AI-powered summarization
   ```bash
   npm install -g @steipete/summarize
   ```

2. **yt-dlp**: For YouTube transcript extraction
   ```bash
   brew install yt-dlp
   ```

3. **ffmpeg**: For audio processing (optional)
   ```bash
   brew install ffmpeg
   ```

### API Keys
Set the following environment variables for AI summarization:
- `OPENAI_API_KEY`: For OpenAI models
- `ANTHROPIC_API_KEY`: For Claude models
- `GEMINI_API_KEY`: For Google Gemini models
- `XAI_API_KEY`: For Grok models

### Custom Configuration
Create `~/.nanobot/youtube-summarizer.json`:
```json
{
  "default_model": "google/gemini-3-flash-preview",
  "default_language": "en",
  "cache_transcripts": true,
  "output_dir": "~/Documents/YouTube_Summaries"
}
```

## Integration with Existing Skills

This skill integrates with:
- **summarize**: For AI-powered text summarization
- **transcription**: For audio processing (if needed)
- **file management**: For saving summaries to files

## Error Handling

The skill handles common errors:
- **Video unavailable**: Provides clear error message
- **No transcripts**: Offers to summarize based on description/comments
- **Rate limiting**: Implements exponential backoff
- **Network issues**: Retries with increasing delays

## Performance Tips

1. **Cache transcripts** to avoid repeated downloads
2. **Use appropriate summary length** based on video duration
3. **Batch process** multiple videos for efficiency
4. **Enable parallel processing** for multiple videos

## Development

To contribute to this skill:
1. Check the source code in `src/skills/youtube-summarizer/`
2. Follow the nanobot skill development guidelines
3. Test with various YouTube video types
4. Submit pull requests with comprehensive tests

## License

Part of the nanobot-ts project. See main project license for details.
