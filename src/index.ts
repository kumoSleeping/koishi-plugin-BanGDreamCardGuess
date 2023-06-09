import { Context, Schema, h, Database } from 'koishi';
// import { createPool, Pool, PoolConfig } from 'mysql'
import { createCanvas, loadImage } from 'canvas';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import fs from 'fs';
import axios from 'axios';
import path from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { userInfo } from 'os';
import { PassThrough } from 'stream';

// TypeScript 用户需要进行类型合并
declare module 'koishi' {
  interface Tables {
    schedule: Schedule
  }
}

export const name = 'test';

export interface Config { }

// 在控制台页面显示介绍
export const usage = '猜 BanGDream！角色卡面游戏～';

export const Config: Schema<Config> = Schema.object({});

export function apply(ctx: Context) {


  // 启用时尝试创建文件夹
  const folderPath = path.resolve(__dirname, '..', 'assets', 'cards');

  try {
    fs.mkdirSync(folderPath, { recursive: true });
    console.log('文件夹创建成功：', folderPath);
  } catch (error) {
    console.error('创建文件夹时出错', error);
  }
  // 启用时尝试创建数据表
  try {
    ctx.model.extend('test4_cck_user', {
      // 各字段类型
      id: 'integer',
      platform: 'string',
      userId: 'number',
      guildId: 'number',
      counts: 'number',

    }, {
      // 使用自增的主键值
      autoInc: true,
    })
    console.log('数据表创建成功：');
  } catch (error) {
    console.error('数据表创建出错', error);
  }

  // 启用时尝试创建数据表2
  try {
    ctx.model.extend('test7_cck_set', {
      // 各字段类型
      id: 'integer',
      status: 'number',
      platform: 'string',
      guildId: 'number',
      answer_now: 'number',
      card_id_now: 'number',
      answer_pre: 'number',
      card_id_pre: 'number',
      counts: 'number',
      rcd_time: 'string',
    }, {
      // 使用自增的主键值
      autoInc: true,
    })
    console.log('数据表创建成功：');
  } catch (error) {
    console.error('数据表创建出错', error);
  }

  let cck_json: JSON;
  // 读取cck_JSON文件
  const cckPath = path.resolve(__dirname, './cck.json');
  fs.readFile(cckPath, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return;
    }

    // 解析JSON为JavaScript对象
    cck_json = JSON.parse(data);
  });


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


  const cutImagesPath = path.resolve(__dirname, '../assets/cards');


  // 使用 fs.readdirSync 函数读取 cutImagesPath 目录下的所有文件，并将文件列表保存在 files 变量中。
  // 对文件列表进行过滤，只保留文件名以 platform + "_" + guildId 开头的文件。使用 Array.filter 方法对 files 数组进行过滤操作。
  // 对过滤后的文件列表进行截取，只保留前三个文件。使用 Array.slice 方法截取前三个文件。
  // 对截取后的文件列表进行遍历，并对每个文件执行以下操作：
  // 构建完整的图片路径，使用 path.join 函数将 cutImagesPath 和文件名拼接起来。
  // 使用 fs.readFileSync 函数读取图片文件的二进制数据，保存在 imageBuffer 变量中。
  // 将图片二进制数据转换为 Base64 编码格式，保存在 base64Image 变量中。
  // 构建完整的图片数据 URI，以 data:image/png;base64, 开头，后跟 Base64 编码的图片数据。
  // 返回处理后的图片数据 URI 数组。
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


  // 传入「图片URL，保存路径」，下载图片
  async function downloadImage(url, outputPath) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    fs.writeFileSync(outputPath, Buffer.from(response.data, 'binary'));
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

  // 切割图片并保存三次，传入「图片路径，平台，公会ID」返回三张图片的base64（因为randomCropImage返回base64）
  function cropAndSaveImages(inputImagePath, platform, guildId) {
    for (let i = 1; i <= 3; i++) {
      const outputImagePath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}${i}.png`);
      randomCropImage(inputImagePath, outputImagePath, 300, 100);
    }
  }


  // 根据all.json，返回url，卡面ID，角色ID
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
      console.log(randomCard);

      return {
        imageUrl: imageUrl,
        cardId: Object.keys(cards).find(key => cards[key] === randomCard),
        characterId: randomCard.characterId
      };
    }

    return null; // 如果没有符合条件的稀有卡牌，则返回null或适合的默认值
  }

  ctx.middleware(async (session, next) => {
    if (session.content === 'cck') {
      const platform = session.platform;
      const guildId = session.guildId;

      const images = getCutImages(platform, guildId);
      // 有缓存
      if (images.length > 0) {
        const result = await ctx.database.get('test7_cck_set', { platform: platform, guildId: guildId });

        // if (result.length > 0) {
        const status = result[0].status;
        // console.log(status);
        if (status === 1) {
          session.send(`游戏正在进行中ing，可以发送bzd结束～`);
          return
        }
        else {
          // 开始了不管
          PassThrough
        }

        const images = getCutImages(platform, guildId);
        if (images.length > 0) {
          await ctx.database.set('test7_cck_set', { platform: platform, guildId: guildId }, {
            status: 1, // 设置 status 为 1
          })
          session.send(`猜猜她是谁吧～\n${images.map(image => h.image(image)).join('\n')}`);
        }
        else {
          session.send(`没有图片了，怎么会这样，衫裤吧（`);
        }

        // 重命名 "answer_pre" 为 "answer_now"
        const answerPrePath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}_answer_pre.png`);
        const answerNowNewPath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}_answer_now.png`);
        fs.renameSync(answerPrePath, answerNowNewPath);

        // 下载图片逻辑，保存为 "answer_pre"
        const RandomCardMsg = await getRandomCardMsg();
        const imageUrl = RandomCardMsg.imageUrl;
        const cardId = RandomCardMsg.cardId;
        const characterId = RandomCardMsg.characterId;
        const imagePath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}_answer_pre.png`);
        await downloadImage(imageUrl, imagePath);

        // 切割图片并保存三次
        cropAndSaveImages(imagePath, platform, guildId);
        const rows = [{
          platform: platform,
          guildId: guildId,
          status: 1, // 设置初始值为 1 表示运行中
          answer_now: result[0].answer_now, // 设置 answer_now 初始值为空字符串
          card_id_now: result[0].card_id_now, // 设置 card_id_now 初始值为 0
          answer_pre: characterId, // 设置 answer_pre 初始值为空字符串
          card_id_pre: cardId, // 设置 card_id_pre 初始值为 0
          counts: 1, // 设置 counts 初始值为 1
          rcd_time: "" // 设置 rcd_time 初始值为空字符串
        }];
        PassThrough
        await ctx.database.upsert('test7_cck_set', rows, ['platform', 'guildId']);
      }
      // 第一次使用
      else {
        session.send(`初始化ing～\n玩法介绍：\n将会筛选3/4/5星随机卡面\n随机裁剪三份\n玩家需要发送「是xxx」来猜测，例如：\n「是ksm」「是香澄」\n如果不知道可以发送「不知道/bzd」\n每人有三次回答机会～`);
        // 下载图片逻辑，保存为 "answer_now"
        const imagePath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}_answer_pre.png`);
        const RandomCardMsg = await getRandomCardMsg();
        // 下载
        const imageUrl = RandomCardMsg.imageUrl;
        await downloadImage(imageUrl, imagePath);
        // 操作set数据库
        const answer_now = RandomCardMsg.characterId;
        const card_id_now = RandomCardMsg.cardId;
        const rows = [{
          platform: platform,
          guildId: guildId,
          status: 0,
          answer_now: answer_now,
          card_id_now: card_id_now,
          answer_pre: 1,
          card_id_pre: 1,
          counts: 1,
          rcd_time: ""
        }];
        PassThrough
        await ctx.database.upsert('test7_cck_set', rows, ['platform', 'guildId']);


        // 切割图片并保存三次
        cropAndSaveImages(imagePath, platform, guildId);
        session.send(`再次发送「cck」开始游戏吧～`);
      }

    }
    return next();
  });






  ctx.middleware(async (session, next) => {
    if (session.content.startsWith('是')) {
      const platform = session.platform;
      const userId = session.userId;
      const guildId = session.guildId;

      const result = await ctx.database.get('test4_cck_user', { platform, userId, guildId }, ['counts']);

      // 提取输入中的词语
      const keyword = session.content.substring(1).trim();
      // 检查是否存在词语
      let found = false;
      let number: number = null;
      let answer: number = null;

      for (const [key, values] of Object.entries(cck_json)) {
        if (values.includes(keyword)) {
          found = true;
          const num = parseInt(key, 10);
          number = num;
          const result = await ctx.database.get('test7_cck_set', { platform, guildId }, ['answer_now']);
          if (result.length > 0) {
            answer = result[0].answer_now;
            console.log(answer);
            console.log(number);
          }
        }
      }

      if (found) {
        if (number && answer) {
          // 操作数据库
          if (result.length > 0) {
            // 先确保你的回答是邦的人物
            const counts = result[0].counts;

            if (counts === 3) {
              await session.send(`${h.at({ id: userId })}你已经回答三次啦～`);
              return;
            }

            const rows = [{ platform, userId, guildId, counts: { $add: [{ $: 'counts' }, 1] } }];
            await ctx.database.upsert('test4_cck_user', rows, ['platform', 'userId', 'guildId']);
          } else {
            // 如果不存在匹配的数据行，则规定 counts 为 1
            const rows = [{ platform, userId, guildId, counts: 1 }];
            await ctx.database.upsert('test4_cck_user', rows, ['platform', 'userId', 'guildId']);
          }

          if (number === answer) {
            console.log(`编号 ${number} 和答案匹配`);
            // 「一」设置数据库操作
            const result = await ctx.database.get('test7_cck_set', { platform: platform, guildId: guildId });
            console.log(result[0].answer_pre);
            console.log(result[0].card_id_pre);
            const rows = [{
              platform: platform,
              guildId: guildId,
              status: 0, // 设置初始值为 0 表示结束
              answer_now: result[0].answer_pre, // 
              card_id_now: result[0].card_id_pre, //
              answer_pre: 2, // 设置 answer_pre 1
              card_id_pre: 2, // 设置 card_id_pre 初始值为 1
              counts: 1, // 设置 counts 初始值为 1
              rcd_time: "" // 设置 rcd_time 初始值为空字符串
            }];
            await ctx.database.upsert('test7_cck_set', rows, ['platform', 'guildId']);

            // 「二」发送消息（前端任务结束）
            const imagePath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}_answer_now.png`);
            // 读取本地图片文件
            const imageBufferRead = fs.readFileSync(imagePath);
            // 将图片转换为 Base64
            const base64Image = imageBufferRead.toString('base64');
            // 构造 data URI
            const dataUri = `data:image/png;base64,${base64Image}`;
            // 发送图片
            session.send(`${h.at({ id: userId })}正确！答案是————\n${h.image(dataUri)}`);

            // 「三」用户数据库释放（数据库任务结束）
            await ctx.database.remove('test4_cck_user', { guildId, platform });
          } else {
            console.log(`编号 ${number} 和答案不匹配`);
            PassThrough
          }
        }
        // 如果不是邦的人物
      } else {
        PassThrough
      }
    }

    return next();
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




  // cck结束「回答正确/bzd」，删除所有「平台，guildId相符」的数据
  ctx.middleware(async (session, next) => {
    if (['不知道', 'bzd'].includes(session.content)) {
      const guildId = session.guildId;
      const platform = session.platform;
      // 「一」设置数据库操作
      const result = await ctx.database.get('test7_cck_set', { platform: platform, guildId: guildId });
      console.log(result[0].answer_pre);
      console.log(result[0].card_id_pre);
      const rows = [{
        platform: platform,
        guildId: guildId,
        status: 0, // 设置初始值为 0 表示结束
        answer_now: result[0].answer_pre, // 
        card_id_now: result[0].card_id_pre, //
        answer_pre: 2, // 设置 answer_pre 1
        card_id_pre: 2, // 设置 card_id_pre 初始值为 1
        counts: 1, // 设置 counts 初始值为 1
        rcd_time: "" // 设置 rcd_time 初始值为空字符串
      }];
      await ctx.database.upsert('test7_cck_set', rows, ['platform', 'guildId']);

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

      // 「三」用户数据库释放（数据库任务结束）
      await ctx.database.remove('test4_cck_user', { guildId, platform });



      return next();
    } else {
      return next();
    }
  });

  ctx.middleware(async (session, next) => {
    if (session.content === '12') {
      const platform = session.platform;
      const guildId = session.guildId;
      
      try {
        // 第二个参数也可以使用上面介绍的查询表达式
        await ctx.database.set('test7_cck_set', { platform: platform, guildId: guildId }, {
          status: 2, // 设置 status 为 1
        })

        
      } catch (error) {
        session.send('内部错误。');
        console.error('内部错误。', error);
      }
      return next();
    } else {
      return next();
    }
  });

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





























