import { Context, Schema, h, Database } from 'koishi';
import fs from 'fs';
import path from 'path';
// import { readFileSync, writeFileSync } from 'fs';
import { PassThrough } from 'stream';
import Jimp from 'jimp';



// TypeScript 用户需要进行类型合并
declare module 'koishi' {
  interface Tables {
    cck_user: Cck_user
    cck_set: Cck_set
  }
}

export interface Cck_user {
  id: number,
  platform: string,
  userId: string,
  guildId: string,
  counts: number,
}

export interface Cck_set {
  // 各字段类型
  id: number
  status: number,
  platform: string,
  guildId: string,
  answer_now: number,
  card_id_now: number,
  answer_pre: number,
  card_id_pre: number,
  counts: number,
  rcd_time: string,
}

export interface Config {
  cd: number
  cut_length: number
  cut_width: number
  cut_count: number
}
export const name = 'test';

export interface Config { }

// 在控制台页面显示介绍
export const usage = '猜BanGDream！角色卡面游戏～\n此插件依赖「bestdori.com」';

export const schema = Schema.object({
  cd: Schema.number().default(5)
    .description('上一轮结束后的冷却时间(单位s)【建议设置大于4s，否则可能导致图片预下载失败】'),
  cut_length: Schema.number().default(100)
    .description('切片高度(<1002)【修改后下一轮游戏结束后生效】'),
  cut_width: Schema.number().default(300)
    .description('切片宽度(<1334)【修改后下一轮游戏结束后生效】'),
  cut_count: Schema.number().default(3)
    .description('切片数量【修改后请使用指令「cck -R」清空所有已裁剪缓存】'),
})
// export const Config: Schema<Config> = Schema.object({
//   width: Schema.number().default(100).description('默认图片宽度。'),
//   height: Schema.number().default(100).description('默认图片高度。'),
// })

// export const Config: Schema<Config> = Schema.object({});

export function apply(ctx: Context, config: Config) {


  // let cd: number = 5 // cck的cd时间

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
    ctx.model.extend('cck_user', {
      // 各字段类型
      id: 'unsigned',
      platform: 'string',
      userId: 'string',
      guildId: 'string',
      counts: 'integer',

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
    ctx.model.extend('cck_set', {
      // 各字段类型
      id: 'integer',
      status: 'integer',
      platform: 'string',
      guildId: 'string',
      answer_now: 'integer',
      card_id_now: 'integer',
      answer_pre: 'integer',
      card_id_pre: 'integer',
      counts: 'integer',
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
      const responseData = await ctx.http('get', 'https://bestdori.com/api/cards/all.5.json');
      cards = responseData;

      // 保存卡片数据到本地
      fs.writeFileSync(allCardsPath, JSON.stringify(cards));
    }

    return cards;
  }


  const cutImagesPath = path.resolve(__dirname, '../assets/cards'.replace(':', ''));

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


  // 使用 fs.readdirSync 函数读取 cutImagesPath 目录下的所有文件，并将文件列表保存在 files 变量中。
  // 对文件列表进行过滤，只保留文件名以 platform + "_" + guildId 开头的文件。使用 Array.filter 方法对 files 数组进行过滤操作。
  // 对过滤后的文件列表进行截取，只保留前三个文件。使用 Array.slice 方法截取前三个文件。
  // 对截取后的文件列表进行遍历，并对每个文件执行以下操作：
  // 构建完整的图片路径，使用 path.join 函数将 cutImagesPath 和文件名拼接起来。
  // 使用 fs.readFileSync 函数读取图片文件的二进制数据，保存在 imageBuffer 变量中。
  // 将图片二进制数据转换为 Base64 编码格式，保存在 base64Image 变量中。
  // 构建完整的图片数据 URI，以 data:image/png;base64, 开头，后跟 Base64 编码的图片数据。
  // 返回处理后的图片数据 URI 数组。
  function getCutImages(platform: string, guildId: string): string[] {
    const files = fs.readdirSync(cutImagesPath);
    return files
      .filter(file => {
        const modifiedFile = file.startsWith(`${platform}_${guildId}`.replace(':', ''));
        const endsWithPreOrNow = !file.endsWith("pre.png") && !file.endsWith("now.png");
        return modifiedFile && endsWithPreOrNow;
      })
      .slice(0, config.cut_count)
      .map(file => {
        const imagePath = path.join(cutImagesPath, file);
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');
        return `data:image/png;base64,${base64Image}`;
      });
  }


  // 传入「图片URL，保存路径」，下载图片
  async function downloadImage(url, outputPath) {
    const responseType: 'arraybuffer' = 'arraybuffer';
    const config = {
      responseType
    };

    // koishi内置网络服务，使用 ctx.http 发起请求时，返回的结果是直接解构出来的
    const responseData = await ctx.http('get', url, config);
    fs.writeFileSync(outputPath, Buffer.from(responseData, 'binary'));
  }


  async function randomCropImage(inputImagePath: string, outputImagePath: string): Promise<void> {
    try {
      const image = await Jimp.read(inputImagePath);

      // 随机计算矩形的起始坐标
      const x = Math.floor(Math.random() * (image.bitmap.width - config.cut_width));
      const y = Math.floor(Math.random() * (image.bitmap.height - config.cut_length));

      // 裁剪图片
      const croppedImage = image.clone().crop(x, y, config.cut_width, config.cut_length);

      // 保存裁剪后的图片
      await croppedImage.writeAsync(outputImagePath);

      console.log(`切割完成，保存为 ${outputImagePath}`);
    } catch (error) {
      console.error('切割图片时出错:', error);
    }
  }

  // const sharp = require('sharp');

  // async function randomCropImage(inputImagePath, outputImagePath) {
  //   try {
  //     // 使用Sharp读取输入图像
  //     const image = sharp(inputImagePath);
  
  //     // 获取图像的元数据
  //     const metadata = await image.metadata();
  
  //     // 随机计算矩形的起始坐标
  //     const x = Math.floor(Math.random() * (metadata.width - config.cut_width));
  //     const y = Math.floor(Math.random() * (metadata.height - config.cut_length));
  
  //     // 裁剪图片
  //     const croppedImage = await image
  //       .extract({ left: x, top: y, width: config.cut_width, height: config.cut_length })
  //       .toFile(outputImagePath);
  
  //     console.log(`切割完成，保存为 ${outputImagePath}`);
  //   } catch (error) {
  //     console.error('切割图片时出错:', error);
  //   }
  // }

  // async function randomCropImage(inputImagePath: string, outputImagePath: string): Promise<void> {
  //   try {
  //     const image_width = 1002;
  //     const image_height = 1334;

  //     // 获取图像容器元素
  //     const imageContainer = document.getElementById('imageContainer');

  //     // 创建 Croppie 实例，并指定图像容器元素
  //     const croppie = new Croppie(imageContainer, {
  //       viewport: { width: config.cut_width, height: config.cut_length },
  //       boundary: { width: image_width, height: image_height },
  //     });

  //     // 将图像绑定到 Croppie 实例
  //     await croppie.bind({ url: inputImagePath });

  //     // 随机计算矩形的起始坐标
  //     const x = Math.floor(Math.random() * (image_width - config.cut_width));
  //     const y = Math.floor(Math.random() * (image_height - config.cut_length));

  //     // 设置裁剪框的位置
  //     croppie.setCropBoxData({ left: x, top: y });

  //     // 获取裁剪结果
  //     const croppedImage = await croppie.result({
  //       type: 'base64',
  //       format: 'jpeg',
  //       quality: 100,
  //     });

  //     // 将裁剪结果保存为图像文件
  //     const base64Data = croppedImage.replace(/^data:image\/jpeg;base64,/, '');
  //     require('fs').writeFileSync(outputImagePath, base64Data, 'base64');

  //     console.log(`切割完成，保存为 ${outputImagePath}`);
  //   } catch (error) {
  //     console.error('切割图片时出错:', error);
  //   }
  // }

  // // 调用函数并传递输入输出路径
  // randomCropImage('input.jpg', 'output.jpg');




  // 切割图片并保存三次，传入「图片路径，平台，公会ID」返回三张图片的base64（因为randomCropImage返回base64）
  function cropAndSaveImages(inputImagePath, platform, guildId) {
    for (let i = 1; i <= config.cut_count; i++) {
      const outputImagePath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}${i}.png`.replace(':', ''));
      randomCropImage(inputImagePath, outputImagePath);
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
        const result = await ctx.database.get('cck_set', { platform: platform, guildId: guildId });

        const rcdTime = result[0].rcd_time; // 获取数据库中的时间字符串

        const currentTime = new Date(); // 获取当前时间
        const rcdDate = new Date(rcdTime); // 将数据库中的时间字符串转换为日期对象
        const timeDiff = currentTime.getTime() - rcdDate.getTime(); // 计算时间差（毫秒）
        const secondDiff = Math.floor((timeDiff / 1000) % 60); // 计算秒数差异
        const minuteDiff = Math.floor(timeDiff / (1000 * 60)); // 将时间差转换为分钟
        // console.log('timeDiff', secondDiff);

        // 超过一分钟可以无视status直接开始
        if (minuteDiff > 1) {
          PassThrough
        } else {
          // if (result.length > 0) {
          const status = result[0].status;
          // console.log(status);
          if (secondDiff < config.cd) {
            return
          }
          if (status === 1) {
            session.send(`游戏正在进行中ing，可以发送bzd结束～`);
            return
          }
          else {
            // 开始了不管
            PassThrough
          }
          PassThrough
        }


        const images = getCutImages(platform, guildId);
        if (images.length > 0) {
          await ctx.database.set('cck_set', { platform: platform, guildId: guildId }, {
            status: 1, // 设置 status 为 1
          })
          session.send(`猜猜她是谁吧～\n${images.map(image => h.image(image)).join('\n')}`);
        }
        else {
          session.send(`没有图片了，怎么会这样，衫裤吧（`);
        }

        // 重命名 "answer_pre" 为 "answer_now"
        const answerPrePath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}_answer_pre.png`.replace(':', ''));
        const answerNowNewPath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}_answer_now.png`.replace(':', ''));
        fs.renameSync(answerPrePath, answerNowNewPath);

        // 下载图片逻辑，保存为 "answer_pre"
        const RandomCardMsg = await getRandomCardMsg();
        const imageUrl = RandomCardMsg.imageUrl;
        const cardId = RandomCardMsg.cardId;
        
        const cardId_number: number = parseInt(cardId);
        const characterId = RandomCardMsg.characterId;
        
        const imagePath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}_answer_pre.png`.replace(':', ''));
        const rcd_time = new Date().toISOString(); // 获取当前时间并转换为 ISO 8601 格式的字符串
        
        const rows = [{
          platform: platform,
          guildId: guildId,
          status: 1, // 设置初始值为 1 表示运行中
          answer_now: result[0].answer_now, // 设置 answer_now 初始值为空字符串
          card_id_now: result[0].card_id_now, // 设置 card_id_now 初始值为 0
          answer_pre: characterId, // 设置 answer_pre 初始值为空字符串
          card_id_pre: cardId_number, // 设置 card_id_pre 初始值为 0
          counts: 1, // 设置 counts 初始值为 1
          rcd_time: rcd_time // 设置 rcd_time 初始值为空字符串
        }];
        
        await ctx.database.upsert('cck_set', rows, ['platform', 'guildId']);
        await downloadImage(imageUrl, imagePath);

        // 切割图片并保存三次
        cropAndSaveImages(imagePath, platform, guildId);

      }
      // 第一次使用
      else {
        session.send(`初始化ing～(请稍等)\n玩法介绍：\n将会筛选3/4/5星随机卡面\n随机裁剪三份\n玩家需要发送「是xxx」来猜测，例如：\n「是ksm」「是香澄」「是猫猫头」\n如果不知道可以发送「不知道/bzd」\n每人有三次回答机会～`);
        // 下载图片逻辑，保存为 "answer_now"
        const imagePath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}_answer_pre.png`.replace(':', ''));
        const RandomCardMsg = await getRandomCardMsg();
        // 下载
        const imageUrl = RandomCardMsg.imageUrl;
        await downloadImage(imageUrl, imagePath);
        // 操作set数据库
        const answer_now = RandomCardMsg.characterId;
        const card_id_now = RandomCardMsg.cardId;
        const card_id_now_number: number = parseInt(card_id_now);
        const rcd_time = new Date(); // 获取当前时间的 Date 对象
        rcd_time.setSeconds(rcd_time.getSeconds() - 3 - config.cd); // 将秒数 - (3+cd) 秒，模拟在 (3+cd) 秒前结束过游戏

        const rcd_timeString = rcd_time.toISOString(); // 将修改后的时间转换为 ISO 8601 格式的字符串
        // console.log(rcd_timeString);
        const rows = [{
          platform: platform,
          guildId: guildId,
          status: 0,
          answer_now: answer_now,
          card_id_now: card_id_now_number,
          answer_pre: 1,
          card_id_pre: 1,
          counts: 1,
          rcd_time: rcd_timeString // 十秒前的时间，以便于直接cck
        }];
        PassThrough
        await ctx.database.upsert('cck_set', rows, ['platform', 'guildId']);


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
      const result_set = await ctx.database.get('cck_set', { platform, guildId });
      const result_user = await ctx.database.get('cck_user', { platform, userId, guildId }, ['counts']);

      const status = result_set[0].status;
      const answer = result_set[0].answer_now;
      const card_id_now = result_set[0].card_id_now;

      // 如果没进行就不继续下面的代码了
      if (status === 0) {
        return;
      } else {
        // 在cck
        // 执行相关操作
      }

      // 提取输入中的词语
      const keyword = session.content.substring(1).trim();
      // 检查是否存在词语
      let found = false;
      let number = null;

      for (const [key, values] of Object.entries(cck_json)) {
        if (values.includes(keyword)) {
          found = true;
          const num = parseInt(key, 10);
          number = num;
        }
      }

      if (!found) {
        return;
      }

      if (number && answer) {
        // 操作数据库
        // console.log(result_user);
        if (result_user.length > 0) {
          // 先确保你的回答是邦的人物
          const counts = result_user[0].counts;

          if (counts === 3) {
            await session.send(`${h.at({ id: userId })}你已经回答三次啦～`);
            return;
          }
          const counts_new = counts + 1;

          const rows = [{ platform, userId, guildId, counts: counts_new }];
          await ctx.database.upsert('cck_user', rows, ['platform', 'userId', 'guildId']);
        } else {
          // 如果不存在匹配的数据行，则规定 counts 为 1
          const rows = [{ platform, userId, guildId, counts: 1 }];
          await ctx.database.upsert('cck_user', rows, ['platform', 'userId', 'guildId']);
        }

        if (number === answer) {
          // console.log(`编号 ${number} 和答案匹配`);
          const numberString = number.toString();

          const lp_name = cck_json[numberString][0];

          // 「一」设置数据库操作
          const result = await ctx.database.get('cck_set', { platform: platform, guildId: guildId });
          // console.log(result[0].answer_pre);
          // console.log(result[0].card_id_pre);
          const rcd_time = new Date().toISOString(); // 获取当前时间并转换为 ISO 8601 格式的字符串
          const newRows = [{
            platform: platform,
            guildId: guildId,
            status: 0, // 设置初始值为 0 表示结束
            answer_now: result[0].answer_pre, //
            card_id_now: result[0].card_id_pre, //
            answer_pre: 2, // 设置 answer_pre 1
            card_id_pre: 2, // 设置 card_id_pre 初始值为 1
            counts: 1, // 设置 counts 初始值为 1
            rcd_time: rcd_time // 设置 rcd_time 为当前时间
          }];
          await ctx.database.upsert('cck_set', newRows, ['platform', 'guildId']);

          // 「二」发送消息（前端任务结束）
          const imagePath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}_answer_now.png`.replace(':', ''));
          // 读取本地图片文件
          const imageBufferRead = fs.readFileSync(imagePath);
          // 将图片转换为 Base64
          const base64Image = imageBufferRead.toString('base64');
          // 构造 data URI
          const dataUri = `data:image/png;base64,${base64Image}`;
          // 发送图片
          session.send(`${h.at({ id: session.userId })}正确！答案是————${lp_name}\n${h.image(dataUri)}\ncard_id: ${card_id_now}\ncd被设置为 ${config.cd} 秒`);

          // 「三」用户数据库释放（数据库任务结束）
          await ctx.database.remove('cck_user', { guildId, platform });
        } else {
          // console.log(`编号 ${number} 和答案不匹配`);
          // 执行其他操作
        }
      }
    } else {
      // 执行其他操作
    }

    return next();
  });

  // cck结束「回答正确/bzd」，删除所有「平台，guildId相符」的数据
  ctx.middleware(async (session, next) => {
    if (['不知道', 'bzd'].includes(session.content)) {
      const guildId = session.guildId;
      const platform = session.platform;

      const result = await ctx.database.get('cck_set', { platform: platform, guildId: guildId });
      const card_id_now = result[0].card_id_now;
      const status = result[0].status;
      const answer_now = result[0].answer_now;

      // 如果没进行就不继续下面的代码了
      if (status === 0) {
        return
      }
      else {
        // 在cck
        PassThrough
      }

      // 「一」设置数据库操作

      // console.log(result[0].answer_pre);
      // console.log(result[0].card_id_pre);
      const rcd_time = new Date().toISOString(); // 获取当前时间并转换为 ISO 8601 格式的字符串
      const rows = [{
        platform: platform,
        guildId: guildId,
        status: 0, // 设置初始值为 0 表示结束
        answer_now: result[0].answer_pre, // 
        card_id_now: result[0].card_id_pre, //
        answer_pre: 0, // 设置 answer_pre 0
        card_id_pre: 0, // 设置 card_id_pre 初始值为 0
        counts: 1, // 设置 counts 初始值为 1
        rcd_time: rcd_time // 设置 rcd_time 初始值为空字符串
      }];
      await ctx.database.upsert('cck_set', rows, ['platform', 'guildId']);

      // 「二」发送消息（前端任务结束）
      const imagePath = path.resolve(__dirname, `../assets/cards/${platform}_${guildId}_answer_now.png`.replace(':', ''));
      // 读取本地图片文件
      const imageBufferRead = fs.readFileSync(imagePath);
      // 将图片转换为 Base64
      const base64Image = imageBufferRead.toString('base64');
      // 构造 data URI
      const dataUri = `data:image/png;base64,${base64Image}`;
      // 答案编号「answer_now」：number变成 键名：string
      const numberString = answer_now.toString();

      const lp_name = cck_json[numberString][0];
      // 发送图片
      session.send(`答案是————${lp_name}\n${h.image(dataUri)}\ncard_id: ${card_id_now}\ncd被设置为 ${config.cd} 秒`);

      // 「三」用户数据库释放（数据库任务结束）
      await ctx.database.remove('cck_user', { guildId, platform });

      return next();
    } else {
      return next();
    }
  });

  ctx.middleware(async (session, next) => {
    if (session.content === 'cck -D') {
      const platform = session.platform;
      const guildId = session.guildId;
      const folderPathDelete = path.resolve(__dirname, '..', 'assets', 'cards');
      // console.log(folderPathDelete);

      const filePrefix = `${platform}_${guildId}`.replace(':', '');

      if (fs.existsSync(folderPathDelete)) {
        const files = fs.readdirSync(folderPathDelete);
        files.forEach((file) => {
          const filePath = path.join(folderPathDelete, file);
          // console.log(filePath);
          const stats = fs.statSync(filePath);

          if (stats.isFile() && file.startsWith(filePrefix)) {
            fs.unlinkSync(filePath);
            console.log(`文件 ${filePath} 已成功删除！`);
          }
        });
      } else {
        console.log(`文件夹 ${folderPathDelete} 不存在。`);
      }

      return next();
    } else {
      return next();
    }
  });


  ctx.middleware(async (session, next) => {
    if (session.content === 'cck -R') {
      const folderPathDelete = path.resolve(__dirname, '..', 'assets', 'cards');

      const filePrefix = `.png`;

      if (fs.existsSync(folderPathDelete)) {
        const files = fs.readdirSync(folderPathDelete);
        files.forEach((file) => {
          const filePath = path.join(folderPathDelete, file);
          // console.log(filePath);
          const stats = fs.statSync(filePath);

          if (stats.isFile() && file.endsWith(filePrefix)) {
            fs.unlinkSync(filePath);
            console.log(`文件 ${filePath} 已成功删除！`);
          }
        });
      } else {
        console.log(`文件夹 ${folderPathDelete} 不存在。`);
      }

      return next();
    } else {
      return next();
    }
  });


  ctx.command('邦邦猜卡', 'BanG Dream！卡面猜猜看！')
    .usage('开始游戏：\n「cck」// 猜猜看\n猜测，例如：\n「是ksm」「是香澄」「是猫猫头」\n结束游戏：\n「不知道」「bzd」\n每人有三次回答机会，默认cd为5秒\n重置本群资源：\n「cck -D」\n重置全部资源：\n「cck -R」')
  PassThrough

}


























