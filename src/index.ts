import { Context, Schema, h, Database } from 'koishi';
// import { createPool, Pool, PoolConfig } from 'mysql'
import { createCanvas, loadImage } from 'canvas';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import fs from 'fs';
import axios from 'axios';
import path from 'path';
import { readFileSync,writeFileSync } from 'fs';
import { userInfo } from 'os';

// TypeScript 用户需要进行类型合并
declare module 'koishi' {
  interface Tables {
    schedule: Schedule
  }
}

export const name = 'test';

export interface Config {}

// 在控制台页面显示介绍
export const usage ='猜 BanGDream！角色卡面游戏～';

export const Config: Schema<Config> = Schema.object({});

export function apply(ctx: Context) {

// 启用插件时尝试
const folderPath = path.resolve(__dirname, '..', '..', 'test', 'assets', 'cards');

try {
  fs.mkdirSync(folderPath, { recursive: true });
  console.log('文件夹创建成功：', folderPath);
} catch (error) {
  console.error('创建文件夹时出错', error);
}


// 切一小段，返回base64
async function randomCropImage(inputImagePath: string, outputImagePath: string, width: number, height: number): Promise<void> {
  try {
    const image = await loadImage(inputImagePath);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 随机计算矩形的起始坐标
    const x = Math.floor(Math.random() * (image.width - width));
    const y = Math.floor(Math.random() * (image.height - height));

    // 在画布上绘制图片的指定矩形区域
    ctx.drawImage(image, x, y, width, height, 0, 0, width, height);

    // 将画布保存为图片文件
    const buffer = canvas.toBuffer('image/jpeg');
    writeFileSync(outputImagePath, buffer);

    console.log(`切割完成，保存为 ${outputImagePath}`);
  } catch (error) {
    console.error('切割图片时出错:', error);
  }
}

// 检查下载all.json
async function loadCardsData() {
  const allCardsPath = path.resolve(__dirname, '../assets/all.json');
  let cards = [];

  // 检查是否已存在缓存的卡片数据
  if (fs.existsSync(allCardsPath)) {
    // 读取已缓存的卡片数据
    const allCardsContent = fs.readFileSync(allCardsPath, 'utf-8');
    cards = JSON.parse(allCardsContent);
  } else {
    // 发送请求获取卡片数据
    const response = await axios.get('https://bestdori.com/api/cards/all.5.json');
    cards = response.data;

    // 保存卡片数据到本地
    fs.writeFileSync(allCardsPath, JSON.stringify(cards));
  }

  return cards;
}


// ctx.middleware(async (session, next) => {
//   if (session.content === '/card') {
//     const platform = session.platform;
//     try {
//       const cards = await loadCardsData();

//       // 筛选稀有度大于5的卡片
//       const rareCards = Object.values(cards).filter(card => card.rarity > 2);

//       if (rareCards.length > 0) {
//         // 随机选择一张稀有度大于5的卡片
//         const randomCard = rareCards[Math.floor(Math.random() * rareCards.length)];

//         // 构造图片URL
//         const imageUrl = `https://bestdori.com/assets/jp/characters/resourceset/${randomCard.resourceSetName}_rip/card_normal.png`;

//         // 下载图片
//         const imagePath = path.resolve(__dirname, `../assets/cards/${randomCard.characterId}.png`);
//         const response = await axios.get(imageUrl, { responseType: 'stream' });
//         response.data.pipe(fs.createWriteStream(imagePath));

//         response.data.on('end', () => {
//           // 读取本地图片文件
//           const imageBufferRead = fs.readFileSync(imagePath);

//           // 将图片转换为 Base64
//           const base64Image = imageBufferRead.toString('base64');

//           // 构造 data URI
//           const dataUri = `data:image/png;base64,${base64Image}`;

//           // 发送图片
//           session.send(`这是随机的稀有度大于2的卡面：\n${h.image(dataUri)}`);

//           //
//         });
//       } else {
//         session.send('没有找到稀有度大于2的卡片。');
//       }
//     } catch (error) {
//       session.send('内部错误。');
//       console.error('内部错误。', error);
//     }
//     return next();
//   } else {
//     return next();
//   }
// });






const cutImagesPath = path.resolve(__dirname, '../assets/cards');

// 检查本地是否存在切割后的图片
function getCutImages(platform, guildId) {
  const files = fs.readdirSync(cutImagesPath);
  return files
    .filter(file => file.startsWith(platform + '_' + guildId))
    .slice(0, 3)
    .map(file => {
      const imagePath = path.join(cutImagesPath, file);
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      return `data:image/png;base64,${base64Image}`;
    });
}

// 下载图片
async function downloadImage(url, outputPath) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  fs.writeFileSync(outputPath, Buffer.from(response.data, 'binary'));
}

// 切割图片并保存三次
function cropAndSaveImages(inputImagePath, platform, guildId) {
  for (let i = 1; i <= 3; i++) {
    const outputImagePath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}${i}.png`);
    randomCropImage(inputImagePath, outputImagePath, 300, 100);
  }
}




async function getRandomCardMsg() {
  const cards = await loadCardsData();
  const rareCards = Object.values(cards).filter(card => card.rarity > 2);

  if (rareCards.length > 0) {
    const randomCard = rareCards[Math.floor(Math.random() * rareCards.length)];
    let imageUrl;

    if (randomCard.rarity === 3) {
      imageUrl = `https://bestdori.com/assets/jp/characters/resourceset/${randomCard.resourceSetName}_rip/card_normal.png`;
    } else if (randomCard.rarity === 4 || randomCard.rarity === 5) {
      if (randomCard.levelLimit === 60) {
        imageUrl = `https://bestdori.com/assets/jp/characters/resourceset/${randomCard.resourceSetName}_rip/card_after_training.png`;
      } else if (randomCard.levelLimit === 50) {
        const randomChoice = Math.random() < 0.5 ? 'card_normal' : 'card_after_training';
        imageUrl = `https://bestdori.com/assets/jp/characters/resourceset/${randomCard.resourceSetName}_rip/${randomChoice}.png`;
      }
    }

    return {
      imageUrl: imageUrl,
      cardId: randomCard.characterId,
      characterId: randomCard.characterId
    };
  }

  return null; // 如果没有符合条件的稀有卡牌，则返回null或适合的默认值
}

ctx.middleware(async (session, next) => {

  if (session.content === 'cck') {
    const platform = session.platform;
    const guildId = session.guildId;

    try {
      const images = getCutImages(platform, guildId);

      if (images.length > 0) {
        session.send(`猜猜她是谁吧～\n${images.map(image => h.image(image)).join('\n')}`);
        // 操作数据库，将答案存入
        // const rows = [{ platform: platform, userId: userId, guildId: guildId, counts: 1 }];
        // await ctx.database.upsert('test4_cck_user', rows, ['platform', 'userId', 'guildId']);

        // 重命名 "answer_pre" 为 "answer_now"
        const answerPrePath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}_answer_pre.png`);
        const answerNowNewPath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}_answer_now.png`);

        fs.renameSync(answerPrePath, answerNowNewPath);
        
          // 下载图片逻辑，保存为 "answer_pre"
          // 调用函数
          const RandomCardMsg = await getRandomCardMsg();
          const imageUrl = RandomCardMsg.imageUrl;
          const imagePath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}_answer_pre.png`);

          await downloadImage(imageUrl, imagePath);

          // 切割图片并保存三次
          cropAndSaveImages(imagePath, platform, guildId);

      } 
      else {

        session.send('初始化ing');
      
        // 下载图片逻辑，保存为 "answer_now"
        const imagePath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}_answer_now.png`);
        const RandomCardMsg = await getRandomCardMsg();
        const imageUrl = RandomCardMsg.imageUrl;
        await downloadImage(imageUrl, imagePath);
        // 切割图片并保存三次
        cropAndSaveImages(imagePath, platform, guildId);
        // 下载图片逻辑，保存为 "answer_pre"
        const RandomCardMsg_pre = await getRandomCardMsg();
        const imageUrl_pre = RandomCardMsg_pre.imageUrl;
        const imagePath_pre = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}_answer_pre.png`);
        await downloadImage(imageUrl_pre, imagePath_pre);
        const images = getCutImages(platform, guildId);

        if (images.length > 0) {
          session.send(`猜猜她是谁吧～\n${images.map(image => h.image(image)).join('\n')}`);

          // 重命名 "answer_pre" 为 "answer_now"
          const answerPrePath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}_answer_pre.png`);
          const answerNowNewPath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}_answer_now.png`);

          fs.renameSync(answerPrePath, answerNowNewPath);
          
            // 下载图片逻辑，保存为 "answer_pre"
            // 调用函数
            const RandomCardMsg = await getRandomCardMsg();
            const imageUrl = RandomCardMsg.imageUrl;
            const imagePath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}_answer_pre.png`);

            await downloadImage(imageUrl, imagePath);

            // 切割图片并保存三次
            cropAndSaveImages(imagePath, platform, guildId);
        }
      }
    } catch (error) {
      session.send('内部错误。');
      console.error('内部错误。', error);
    }
  }
  return next();
});


ctx.middleware(async (session, next) => {
  if (session.content === '1') {
    const platform = session.platform;
    // 获取用户数据
    const userData = await ctx.database.get('user', 2);
    console.log(userData); // 输出用户数据到控制台

    return next();
  } else {
    return next();
  }
});



ctx.middleware(async (session, next) => {
  if (session.content === '2') {
    const platform = session.platform;
    // 获取用户数据
    const userData = await ctx.database.get('user', 2);
    console.log(userData); // 输出用户数据到控制台
    const data = {
      id: 2,
      name: 'test',
      age: 18,
    };

    // await ctx.database.create('cck', data)
    // 在插件或扩展中获取数据库实例
    const database = ctx.database;


    return next();
  } else {
    return next();
  }
});


ctx.middleware(async (session, next) => {
  if (session.content.startsWith('是')) {
    const platform = session.platform;
    const userId = session.userId;
    const guildId = session.guildId;

    const result = await ctx.database.get('test4_cck_user', {platform: platform, userId: userId, guildId: guildId}, ['counts']);

    if (result.length > 0) {
      // 如果存在匹配的数据行，则获取 counts 字段的值
      const counts = result[0].counts;
      const rows = [{ platform: platform, userId: userId, guildId: guildId, counts: { $add: [{ $: 'counts' }, 1] } }];
      await ctx.database.upsert('test4_cck_user', rows, ['platform', 'userId', 'guildId']);
      
    } else {
      // 如果不存在匹配的数据行，则规定 counts 为 1
      const rows = [{ platform: platform, userId: userId, guildId: guildId, counts: 1 }];
      await ctx.database.upsert('test4_cck_user', rows, ['platform', 'userId', 'guildId']);
    }
    

    return next();
  } else {
    return next();
  }
});



// 提一下实现方法
// 第一次运行cck：
// 1.先下载卡面，切三份切片，保存本地，命名「answer_now」,保存本地
// 2.发送「猜猜是谁（三份切片）」（前端任务完成）
// 3.下载下一次卡面，切3份，覆盖本地3份，下载原图，命名为「answer_pre」
// 此时，assets/cards/内有「answer_pre」「answer_now」「三张卡（下次用）」
// 第二次运行cck：
// 1.发送「猜猜是谁（三份切片）」（前端任务完成）
// 2.删除上一次的「answer_now」，重命名「answer_pre」为「answer_now」
// 3.下载下一次卡面，切3份，覆盖本地3份，下载原图，命名为「answer_pre」
// 此时，assets/cards/内有「answer_pre」「answer_now」「三张卡（下次用）」
// 第三次运行cck：
// ...
// 完成闭环



// 创建一个「cck配置」
ctx.middleware(async (session, next) => {
  if (session.content === '3') {
    const platform = session.platform;

    ctx.model.extend('test4_cck_setting', {
      // 各字段类型
      id: 'integer',
      platform: 'string',
      guildId: 'number',
      status: 'boolean',
      cck_time: 'number',
      user_cache: 'boolean',
    }, {
      // 使用自增的主键值
      autoInc: true,
    })

    return next();
  } else {
    return next();
  }
});
;



// cck结束「回答正确/bzd」，删除所有「平台，guildId相符」的数据
ctx.middleware(async (session, next) => {
  if (['不知道', 'bzd'].includes(session.content)) {
    const guildId = session.guildId;
    const platform = session.platform;
    // 「一」设置数据库操作
    // 「二」发送消息（前端任务结束）
    const imagePath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}_answer_now.png`);
    // 读取本地图片文件
    const imageBufferRead = fs.readFileSync(imagePath);
    // 将图片转换为 Base64
    const base64Image = imageBufferRead.toString('base64');
    // 构造 data URI
    const dataUri = `data:image/png;base64,${base64Image}`;
    // 发送图片
    session.send(`答案是————\n${h.image(dataUri)}`);

    // 「三」用户数据库操作（数据库任务结束）
    await ctx.database.remove('test4_cck_user', { guildId, platform });

    // 「四」进行cck缓存更迭
    // 重命名 "answer_pre" 为 "answer_now"
    // const answerPrePath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}_answer_pre.png`);
    // const answerNowNewPath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}_answer_now.png`);

    // fs.renameSync(answerPrePath, answerNowNewPath);
    
    // // 下载图片逻辑，保存为 "answer_pre"
    // const cards = await loadCardsData();
    // const rareCards = Object.values(cards).filter(card => card.rarity > 2);

    // if (rareCards.length > 0) {
    //   const randomCard = rareCards[Math.floor(Math.random() * rareCards.length)];
    //   const imageUrl = `https://bestdori.com/assets/jp/characters/resourceset/${randomCard.resourceSetName}_rip/card_normal.png`;
    //   const imagePath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}_answer_pre.png`);

    //   await downloadImage(imageUrl, imagePath);

    //   // 切割图片并保存三次
    //   cropAndSaveImages(imagePath, platform, guildId);
    // }
    
    
    return next();
  } else {
    return next();
  }
});




























}




