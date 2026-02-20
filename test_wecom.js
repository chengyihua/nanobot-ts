const axios = require('axios');

// 模拟sendMedia函数中的发送逻辑
async function testSend() {
  const token = "YOUR_ACCESS_TOKEN"; // 需要替换为实际的token
  const toUser = "ChengYiHua";
  const agentid = "YOUR_AGENTID"; // 需要替换为实际的agentid
  const mediaId = "YOUR_MEDIA_ID"; // 需要替换为实际的mediaId
  
  try {
    const response = await axios.post(`https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`, {
      touser: toUser,
      msgtype: "image",
      agentid: Number(agentid),
      image: { media_id: mediaId },
      safe: 0,
    });
    
    console.log("发送结果:", response.data);
    return response.data.errcode === 0;
  } catch (error) {
    console.error("发送错误:", error.message);
    if (error.response) {
      console.error("响应数据:", error.response.data);
    }
    return false;
  }
}

testSend();
