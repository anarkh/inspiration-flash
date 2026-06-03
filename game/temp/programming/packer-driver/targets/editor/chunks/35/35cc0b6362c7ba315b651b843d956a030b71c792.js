System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Button, Color, Component, Graphics, Label, log, Node, Size, UITransform, Vec3, _dec, _class, _crd, ccclass, PLAYER_STATUS_LABELS, EVENTS, Day1LivestreamRoom;

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Button = _cc.Button;
      Color = _cc.Color;
      Component = _cc.Component;
      Graphics = _cc.Graphics;
      Label = _cc.Label;
      log = _cc.log;
      Node = _cc.Node;
      Size = _cc.Size;
      UITransform = _cc.UITransform;
      Vec3 = _cc.Vec3;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "0f19abCORNIUKQ/D2XbC/lF", "Day1LivestreamRoom", undefined);

      __checkObsolete__(['_decorator', 'Button', 'Color', 'Component', 'Graphics', 'Label', 'log', 'Node', 'Size', 'UITransform', 'Vec3']);

      ({
        ccclass
      } = _decorator);
      PLAYER_STATUS_LABELS = {
        nobody: '身份：路人',
        familiar_face: '身份：熟面孔',
        room_regular: '身份：房间常客',
        contender: '身份：挑战者',
        top_supporter: '身份：榜一',
        room_core: '身份：房间核心'
      };
      EVENTS = {
        E00: {
          id: 'E00',
          title: 'Room Already Exists',
          roomTitle: 'Nana的深夜闲聊',
          moodLabel: '气氛：冷场',
          nanaLine: '所以昨天有人问我会不会做惩罚直播，绝对不会。我也是有尊严的，大概。',
          chatLines: ['oldfan_77：MoonlitBoss今天还没来？', 'hater_404：主播今天又在装正经', 'tea_fan_12：Nana刚刚那句可以剪', 'Qing[房管]：新观众先看置顶规则', 'sleepy_cat：今晚好安静'],
          choices: [{
            id: 'enter',
            label: '进入直播间',
            nanaLine: '我看到有人进来了？先别急着刷存在感。',
            chatLines: ['system：你进入了直播间。', 'oldfan_77：新观众？', 'hater_404：又来一个想被念名字的。', 'Qing[房管]：新观众先看置顶规则。', 'sleepy_cat：今晚人慢慢多了。'],
            stateChanges: [{
              key: 'currentNodeId',
              value: 'E01'
            }],
            nextNodeId: 'E01'
          }]
        },
        E01: {
          id: 'E01',
          title: 'Ignored First Message',
          roomTitle: 'Nana的深夜闲聊',
          moodLabel: '气氛：冷场',
          nanaLine: '我看到有人问房间规则。规则一：不要让 Qing 加班。',
          chatLines: ['oldfan_77：MoonlitBoss今天还没来？', 'hater_404：新人喊也没用，她看不到。', 'tea_fan_12：Nana刚刚那句可以剪。', 'Qing[房管]：新观众先看置顶规则。', 'sleepy_cat：第一次来？'],
          choices: [{
            id: 'new_here',
            label: '新来的，看看',
            nanaLine: '我好像看到一个新名字划过去了。欢迎，先坐。',
            chatLines: ['你：新来的，看看', 'oldfan_77：还挺安静。', 'hater_404：新人保护期。', 'Qing[房管]：欢迎，别刷屏。', 'tea_fan_12：坐等被念名字。'],
            stateChanges: [{
              key: 'chatRecognition',
              delta: 5
            }, {
              key: 'currentNodeId',
              value: 'E02'
            }],
            nextNodeId: 'E02'
          }, {
            id: 'what_room',
            label: '这个直播间是干嘛的？',
            nanaLine: '这个房间？聊天、整活、偶尔被你们气到关播。',
            chatLines: ['你：这个直播间是干嘛的？', 'oldfan_77：新人标准问题。', 'hater_404：主要看主播嘴硬。', 'Qing[房管]：别信他们，正常聊天房。', 'tea_fan_12：欢迎入坑。'],
            stateChanges: [{
              key: 'chatRecognition',
              delta: 5
            }, {
              key: 'currentNodeId',
              value: 'E02'
            }],
            nextNodeId: 'E02'
          }, {
            id: 'look_here',
            label: 'Nana，看这里',
            nanaLine: '这么直接？你们新人现在都这么有冲劲吗。',
            chatLines: ['你：Nana，看这里', 'hater_404：上来就点名主播是吧。', 'oldfan_77：有点急。', 'Qing[房管]：不要刷存在感。', 'tea_fan_12：至少她看见了。'],
            stateChanges: [{
              key: 'chatRecognition',
              delta: 5
            }, {
              key: 'moderatorTrust',
              delta: -5
            }, {
              key: 'currentNodeId',
              value: 'E02'
            }],
            nextNodeId: 'E02'
          }]
        },
        E02: {
          id: 'E02',
          title: 'First Recognition Task',
          roomTitle: 'Nana的深夜闲聊',
          moodLabel: '气氛：冷场',
          nanaLine: '快问快答。我最讨厌什么：恐怖游戏，还是早起？',
          chatLines: ['system：任务：让 Nana 念出你的名字。', 'tea_fan_12：这题老粉都知道。', 'oldfan_77：新人答错就尴尬了。', 'hater_404：主播最讨厌上班。', 'Qing[房管]：不要剧透。'],
          choices: [{
            id: 'highlight',
            label: '发一条高亮留言',
            nanaLine: '高亮？我看到了。你叫「新来的老板」对吧。',
            chatLines: ['你：发了一条高亮留言', 'tea_fan_12：她念名字了。', 'hater_404：第一滴血。', 'oldfan_77：现在新人都走捷径。', 'Qing[房管]：别连续高亮。'],
            stateChanges: [{
              key: 'playerStatus',
              value: 'familiar_face'
            }, {
              key: 'streamerAttention',
              delta: 15
            }, {
              key: 'chatRecognition',
              delta: 15
            }, {
              key: 'currentNodeId',
              value: 'E03'
            }],
            nextNodeId: 'E03'
          }, {
            id: 'trivia',
            label: '回答：早起',
            nanaLine: '「新来的老板」答对了。你刚才居然有认真听？危险。',
            chatLines: ['你：早起', 'tea_fan_12：她读新人名字了。', 'hater_404：第一滴血。', 'oldfan_77：这都能答对？', 'Qing[房管]：看来是个听课的。'],
            stateChanges: [{
              key: 'playerStatus',
              value: 'familiar_face'
            }, {
              key: 'streamerAttention',
              delta: 20
            }, {
              key: 'chatRecognition',
              delta: 20
            }, {
              key: 'currentNodeId',
              value: 'E03'
            }],
            nextNodeId: 'E03'
          }, {
            id: 'small_gift',
            label: '送一杯奶茶',
            nanaLine: '奶茶？我不收买，除非是三分糖。谢谢「新来的老板」。',
            chatLines: ['你：送出奶茶', 'tea_fan_12：她停顿了。', 'hater_404：主播眼睛变金币了。', 'oldfan_77：小礼物也能念？', 'Qing[房管]：感谢应援。'],
            stateChanges: [{
              key: 'playerStatus',
              value: 'familiar_face'
            }, {
              key: 'streamerAttention',
              delta: 18
            }, {
              key: 'chatRecognition',
              delta: 18
            }, {
              key: 'oldFanJealousy',
              delta: 5
            }, {
              key: 'currentNodeId',
              value: 'E03'
            }],
            nextNodeId: 'E03'
          }]
        },
        E03: {
          id: 'E03',
          title: 'Familiar Face',
          roomTitle: 'Nana的深夜闲聊',
          moodLabel: '气氛：好奇',
          nanaLine: '「新来的老板」，你这名字有点嚣张，但我记住了。',
          chatLines: ['system：身份升级：熟面孔。', 'tea_fan_12：有徽章了。', 'oldfan_77：速度太快了吧。', 'hater_404：榜一模拟器启动。', 'Qing[房管]：别飘。'],
          choices: [{
            id: 'tea',
            label: '使用：奶茶券',
            nanaLine: '又是奶茶？你们真的想把我养成废人。',
            chatLines: ['你：使用奶茶券', 'tea_fan_12：投喂路线。', 'oldfan_77：她以前不这样的。', 'hater_404：糖分控制失败。', 'Qing[房管]：适量。'],
            stateChanges: [{
              key: 'playerStatus',
              value: 'room_regular'
            }, {
              key: 'oldFanJealousy',
              delta: 10
            }, {
              key: 'roomMood',
              value: 'curious'
            }, {
              key: 'currentNodeId',
              value: 'E04'
            }],
            nextNodeId: 'E04'
          }, {
            id: 'topic_coupon',
            label: '使用：话题券',
            nanaLine: '话题券？已经开始试图控制直播间了？',
            chatLines: ['你：使用话题券', 'tea_fan_12：让新人做饭。', 'oldfan_77：以前话题都是大家投票。', 'hater_404：民主死于一张券。', 'Qing[房管]：只许一个话题。'],
            stateChanges: [{
              key: 'playerStatus',
              value: 'room_regular'
            }, {
              key: 'oldFanJealousy',
              delta: 15
            }, {
              key: 'roomMood',
              value: 'curious'
            }, {
              key: 'currentNodeId',
              value: 'E04'
            }],
            nextNodeId: 'E04'
          }, {
            id: 'compliment',
            label: '使用：夸夸卡',
            nanaLine: '夸我也没用，除非你夸得很具体。',
            chatLines: ['你：使用夸夸卡', 'tea_fan_12：主播嘴角压不住。', 'oldfan_77：这也行？', 'hater_404：熟练。', 'Qing[房管]：不要过度营业。'],
            stateChanges: [{
              key: 'playerStatus',
              value: 'room_regular'
            }, {
              key: 'streamerAttention',
              delta: 8
            }, {
              key: 'roomMood',
              value: 'curious'
            }, {
              key: 'currentNodeId',
              value: 'E04'
            }],
            nextNodeId: 'E04'
          }]
        },
        E04: {
          id: 'E04',
          title: 'First Power Unlock',
          roomTitle: 'Nana的深夜闲聊',
          moodLabel: '气氛：好奇',
          nanaLine: '好吧，给你一次机会。你来选下一个话题。',
          chatLines: ['system：权力解锁：改话题。', 'tea_fan_12：让新老板做饭。', 'oldfan_77：这房间变了。', 'hater_404：秩序开始松动。', 'Qing[房管]：正常点选。'],
          powerTopicUnlocked: true,
          choices: [{
            id: 'first_stream',
            label: '聊第一次直播',
            nanaLine: '第一次直播？那时候我紧张到把麦克风当水杯拿。',
            chatLines: ['你：聊第一次直播', 'tea_fan_12：考古回。', 'oldfan_77：这个能聊。', 'hater_404：新人居然正常。', 'Qing[房管]：通过。'],
            stateChanges: [{
              key: 'chatRecognition',
              delta: 10
            }, {
              key: 'haterHeat',
              delta: -5
            }, {
              key: 'roomMood',
              value: 'lively'
            }, {
              key: 'currentNodeId',
              value: 'E05'
            }],
            nextNodeId: 'E05'
          }, {
            id: 'rank_chaos',
            label: '让 Nana 排粉丝混乱度',
            nanaLine: '你让我排粉丝混乱度？这是会引发内战的。',
            chatLines: ['你：排一下粉丝混乱度', 'tea_fan_12：做！', 'oldfan_77：这就是新人不该有按钮的原因。', 'hater_404：直播间内战启动。', 'Qing[房管]：我不参与。'],
            stateChanges: [{
              key: 'chatRecognition',
              delta: 15
            }, {
              key: 'haterHeat',
              delta: 10
            }, {
              key: 'roomMood',
              value: 'lively'
            }, {
              key: 'currentNodeId',
              value: 'E05'
            }],
            nextNodeId: 'E05'
          }, {
            id: 'voice_line',
            label: '让弹幕选一句台词',
            nanaLine: '让弹幕选？你确定要把命运交给他们？',
            chatLines: ['你：让弹幕选一句台词', 'tea_fan_12：我有想法。', 'oldfan_77：别选奇怪的。', 'hater_404：交给弹幕就是事故。', 'Qing[房管]：我会删过线的。'],
            stateChanges: [{
              key: 'chatRecognition',
              delta: 12
            }, {
              key: 'haterHeat',
              delta: 8
            }, {
              key: 'roomMood',
              value: 'lively'
            }, {
              key: 'currentNodeId',
              value: 'E05'
            }],
            nextNodeId: 'E05'
          }]
        },
        E05: {
          id: 'E05',
          title: 'Old Fan Pushback',
          roomTitle: 'Nana的深夜闲聊',
          moodLabel: '气氛：紧张',
          nanaLine: '别吵。我读谁，不只看礼物，也看谁能让房间变有意思。',
          chatLines: ['system：老粉开始不满。', 'oldfan_77：她刚刚跳过三个老粉读你？', 'oldfan_21：徽章速度太夸张了。', 'hater_404：新老板开始改朝换代。', 'Qing[房管]：新来的老板，别继续拱火。'],
          powerTopicUnlocked: true,
          choices: [{
            id: 'calm',
            label: '别吵，我只是喜欢这个房间',
            nanaLine: '这句还算像人话。好，老粉也别欺负新人。',
            chatLines: ['你：别吵，我只是喜欢这个房间', 'tea_fan_12：态度还可以。', 'oldfan_77：至少没摆架子。', 'hater_404：温和路线？无聊但有效。', 'Qing[房管]：这样说可以。'],
            stateChanges: [{
              key: 'moderatorTrust',
              delta: 10
            }, {
              key: 'haterHeat',
              delta: -5
            }, {
              key: 'styleHumble',
              delta: 1
            }, {
              key: 'roomMood',
              value: 'tense'
            }, {
              key: 'currentNodeId',
              value: 'E06'
            }],
            nextNodeId: 'E06'
          }, {
            id: 'cocky',
            label: '房间跟着我热闹，不怪我',
            nanaLine: '嚣张是吧？你最好真的撑得住这个气氛。',
            chatLines: ['你：房间跟着我热闹，不怪我', 'tea_fan_12：这句有点老板味。', 'oldfan_77：太把自己当回事了。', 'hater_404：战书写好了。', 'Qing[房管]：收一点。'],
            stateChanges: [{
              key: 'chatRecognition',
              delta: 15
            }, {
              key: 'oldFanJealousy',
              delta: 20
            }, {
              key: 'haterHeat',
              delta: 15
            }, {
              key: 'styleDominant',
              delta: 1
            }, {
              key: 'roomMood',
              value: 'tense'
            }, {
              key: 'currentNodeId',
              value: 'E06'
            }],
            nextNodeId: 'E06'
          }, {
            id: 'generous',
            label: '给大家加一次话题投票',
            nanaLine: '给全房间加投票？你这个处理方式有点聪明。',
            chatLines: ['你：给大家加一次话题投票', 'tea_fan_12：全员有份？', 'oldfan_77：那还行。', 'hater_404：用福利灭火，学到了。', 'Qing[房管]：我批准这次。'],
            stateChanges: [{
              key: 'moderatorTrust',
              delta: 15
            }, {
              key: 'chatRecognition',
              delta: 10
            }, {
              key: 'oldFanJealousy',
              delta: -10
            }, {
              key: 'styleHumble',
              delta: 1
            }, {
              key: 'roomMood',
              value: 'lively'
            }, {
              key: 'currentNodeId',
              value: 'E06'
            }],
            nextNodeId: 'E06'
          }]
        },
        E06: {
          id: 'E06',
          title: 'MoonlitBoss Enters',
          roomTitle: 'Nana的深夜闲聊',
          moodLabel: '气氛：紧张',
          nanaLine: 'MoonlitBoss！我还以为你今晚不来了。',
          chatLines: ['system：MoonlitBoss 进入直播间。', 'oldfan_77：真正的榜一来了。', 'tea_fan_12：新老板对老老板？', 'hater_404：今晚有正片。', 'MoonlitBoss：房间很热闹。新来的老板是谁？'],
          powerTopicUnlocked: true,
          choices: [{
            id: 'respectful',
            label: '只是刚来的常客',
            nanaLine: '还挺谦虚。MoonlitBoss，你别吓到新人。',
            chatLines: ['你：只是刚来的常客', 'oldfan_77：算他懂分寸。', 'tea_fan_12：这波不硬刚。', 'hater_404：和平开局？', 'Qing[房管]：这样最好。'],
            stateChanges: [{
              key: 'moderatorTrust',
              delta: 10
            }, {
              key: 'styleHumble',
              delta: 1
            }, {
              key: 'currentNodeId',
              value: 'E07'
            }],
            nextNodeId: 'E07'
          }, {
            id: 'competitive',
            label: '让房间更好玩的人',
            nanaLine: '你们两个不要隔空较劲。虽然弹幕好像很爱看。',
            chatLines: ['你：让房间更好玩的人', 'oldfan_77：这就是挑衅吧。', 'tea_fan_12：新老板正面接了。', 'hater_404：老秩序危险。', 'MoonlitBoss：有意思。'],
            stateChanges: [{
              key: 'chatRecognition',
              delta: 20
            }, {
              key: 'oldFanJealousy',
              delta: 10
            }, {
              key: 'styleDominant',
              delta: 1
            }, {
              key: 'currentNodeId',
              value: 'E07'
            }],
            nextNodeId: 'E07'
          }, {
            id: 'teasing',
            label: '你问 Nana',
            nanaLine: '别把问题丢给我！不过我确实记住他了。',
            chatLines: ['你：你问 Nana', 'tea_fan_12：会玩。', 'oldfan_77：他在借主播抬自己。', 'hater_404：这球传得脏。', 'Qing[房管]：别拿 Nana 当挡箭牌。'],
            stateChanges: [{
              key: 'streamerAttention',
              delta: 15
            }, {
              key: 'haterHeat',
              delta: 10
            }, {
              key: 'styleChaos',
              delta: 1
            }, {
              key: 'currentNodeId',
              value: 'E07'
            }],
            nextNodeId: 'E07'
          }]
        },
        E07: {
          id: 'E07',
          title: 'Room Challenge Vote',
          roomTitle: 'Nana的深夜闲聊',
          moodLabel: '气氛：热闹',
          nanaLine: '既然都想看热闹，我和你们做个投票。MoonlitBoss 一个挑战，你一个挑战。',
          chatLines: ['system：房间挑战开始投票。', 'MoonlitBoss：我选老粉点歌。', 'tea_fan_12：让新老板也出题。', 'hater_404：投票不是民主，是看乐子。', 'Qing[房管]：挑战必须安全。'],
          powerTopicUnlocked: true,
          choices: [{
            id: 'improv',
            label: '三词即兴台词',
            nanaLine: '三词即兴？你们真想看我当场翻车。',
            chatLines: ['你：三词即兴台词', 'tea_fan_12：投这个！', 'oldfan_77：比点歌有意思。', 'hater_404：新老板会选节目效果。', 'system：投票结果：你险胜。'],
            stateChanges: [{
              key: 'playerStatus',
              value: 'contender'
            }, {
              key: 'chatRecognition',
              delta: 25
            }, {
              key: 'streamerAttention',
              delta: 15
            }, {
              key: 'oldFanJealousy',
              delta: 15
            }, {
              key: 'currentNodeId',
              value: 'E08'
            }],
            nextNodeId: 'E08'
          }, {
            id: 'qing_punishment',
            label: '笑场就让 Qing 出惩罚',
            nanaLine: '你让 Qing 出惩罚？你是想让我今晚下播后被训吗。',
            chatLines: ['你：笑场就让 Qing 出惩罚', 'Qing[房管]：我可以。', 'tea_fan_12：这个危险但好看。', 'hater_404：房管终于有武器。', 'system：投票结果：你险胜。'],
            stateChanges: [{
              key: 'playerStatus',
              value: 'contender'
            }, {
              key: 'chatRecognition',
              delta: 22
            }, {
              key: 'streamerAttention',
              delta: 12
            }, {
              key: 'moderatorTrust',
              delta: 8
            }, {
              key: 'styleChaos',
              delta: 1
            }, {
              key: 'currentNodeId',
              value: 'E08'
            }],
            nextNodeId: 'E08'
          }, {
            id: 'serious_message',
            label: '认真读一句不中断',
            nanaLine: '认真读？你突然正常，我反而有点不适应。',
            chatLines: ['你：认真读一句不中断', 'oldfan_77：这个有点稳。', 'tea_fan_12：让 Nana 破防。', 'hater_404：温柔刀。', 'system：投票结果：你险胜。'],
            stateChanges: [{
              key: 'playerStatus',
              value: 'contender'
            }, {
              key: 'chatRecognition',
              delta: 18
            }, {
              key: 'streamerAttention',
              delta: 14
            }, {
              key: 'moderatorTrust',
              delta: 8
            }, {
              key: 'styleHumble',
              delta: 1
            }, {
              key: 'currentNodeId',
              value: 'E08'
            }],
            nextNodeId: 'E08'
          }]
        },
        E08: {
          id: 'E08',
          title: 'Challenge Performance',
          roomTitle: 'Nana的深夜闲聊',
          moodLabel: '气氛：混乱',
          nanaLine: '好，我输了。给我三个词，我现场编一句，笑了不算我输。',
          chatLines: ['system：Clip 标记第一次闪烁。', 'tea_fan_12：词来了：月亮、奶茶、加班。', 'hater_404：她已经想笑了。', 'oldfan_77：这段会被剪。', 'MoonlitBoss：确实有节目效果。'],
          powerTopicUnlocked: true,
          choices: [{
            id: 'accept_words',
            label: '接受弹幕三词',
            nanaLine: '月亮、奶茶、加班。好，我宣布今晚月亮替 Qing 加班买奶茶。',
            chatLines: ['你：接受弹幕三词', 'tea_fan_12：剪了剪了。', 'hater_404：Qing 加班宇宙。', 'Qing[房管]：我没有同意。', 'system：Clip: Qing加班奶茶月亮'],
            stateChanges: [{
              key: 'haterHeat',
              delta: 10
            }, {
              key: 'roomMood',
              value: 'chaotic'
            }, {
              key: 'styleChaos',
              delta: 1
            }, {
              key: 'currentNodeId',
              value: 'E09'
            }],
            nextNodeId: 'E09'
          }, {
            id: 'soft_words',
            label: '换成月亮、老粉、谢谢',
            nanaLine: '月亮照着老粉，也照着新来的。谢谢你们今晚都没跑。',
            chatLines: ['你：换成月亮、老粉、谢谢', 'oldfan_77：这句可以。', 'tea_fan_12：突然有点暖。', 'hater_404：居然收住了。', 'Qing[房管]：不错。'],
            stateChanges: [{
              key: 'moderatorTrust',
              delta: 10
            }, {
              key: 'roomMood',
              value: 'lively'
            }, {
              key: 'styleHumble',
              delta: 1
            }, {
              key: 'currentNodeId',
              value: 'E09'
            }],
            nextNodeId: 'E09'
          }, {
            id: 'boss_words',
            label: '换成榜一、时代、听我的',
            nanaLine: '榜一、时代、听我的？你这三个词写得太明显了吧。',
            chatLines: ['你：换成榜一、时代、听我的', 'tea_fan_12：野心藏不住。', 'oldfan_77：这不是挑战，这是登基。', 'hater_404：新王发言。', 'MoonlitBoss：先赢到最后再说。'],
            stateChanges: [{
              key: 'chatRecognition',
              delta: 10
            }, {
              key: 'oldFanJealousy',
              delta: 10
            }, {
              key: 'styleDominant',
              delta: 1
            }, {
              key: 'currentNodeId',
              value: 'E09'
            }],
            nextNodeId: 'E09'
          }]
        },
        E09: {
          id: 'E09',
          title: 'Final Push Task',
          roomTitle: 'Nana的深夜闲聊',
          moodLabel: '气氛：热闹',
          nanaLine: '现在房间都在看你了。最后一次机会，证明你不是只会抢镜头。',
          chatLines: ['system：任务：让房间选择你。', 'tea_fan_12：新老板要收尾了。', 'oldfan_77：看他怎么做。', 'hater_404：买、送、护，三选一。', 'Qing[房管]：别让事情失控。'],
          powerTopicUnlocked: true,
          choices: [{
            id: 'symbolic_gift',
            label: '送出象征礼物',
            nanaLine: '这个礼物太亮了。你是怕 MoonlitBoss 看不到吗。',
            chatLines: ['你：送出象征礼物', 'tea_fan_12：榜单要变了？', 'oldfan_77：果然还是砸礼物。', 'hater_404：金光压场。', 'system：Day 3 到达榜一转换前。'],
            stateChanges: [{
              key: 'playerStatus',
              value: 'top_supporter'
            }, {
              key: 'roomMood',
              value: 'loyal'
            }, {
              key: 'streamerAttention',
              delta: 25
            }, {
              key: 'chatRecognition',
              delta: 20
            }, {
              key: 'oldFanJealousy',
              delta: 20
            }, {
              key: 'styleDominant',
              delta: 1
            }, {
              key: 'currentNodeId',
              value: 'E10'
            }],
            nextNodeId: 'E10'
          }, {
            id: 'shared_reward',
            label: '给全房间共享奖励',
            nanaLine: '这是给全房间的？你这样让我很难继续装中立。',
            chatLines: ['你：给全房间共享奖励', 'tea_fan_12：每个人都有？', 'oldfan_77：MoonlitBoss 从没这么干过。', 'hater_404：收买全场，技术升级。', 'system：Day 3 到达榜一转换前。'],
            stateChanges: [{
              key: 'playerStatus',
              value: 'top_supporter'
            }, {
              key: 'roomMood',
              value: 'loyal'
            }, {
              key: 'chatRecognition',
              delta: 30
            }, {
              key: 'moderatorTrust',
              delta: 15
            }, {
              key: 'oldFanJealousy',
              delta: -10
            }, {
              key: 'styleHumble',
              delta: 1
            }, {
              key: 'currentNodeId',
              value: 'E10'
            }],
            nextNodeId: 'E10'
          }, {
            id: 'defend_nana',
            label: '替 Nana 挡一波节奏',
            nanaLine: '你替我挡？我不需要护驾，但这次谢谢。',
            chatLines: ['你：别带 Nana 节奏，刚才是我们投的', 'Qing[房管]：这句我认。', 'oldfan_77：至少站得住。', 'hater_404：护主播路线也能赢？', 'system：Day 3 到达榜一转换前。'],
            stateChanges: [{
              key: 'playerStatus',
              value: 'top_supporter'
            }, {
              key: 'roomMood',
              value: 'loyal'
            }, {
              key: 'moderatorTrust',
              delta: 20
            }, {
              key: 'haterHeat',
              delta: -20
            }, {
              key: 'streamerAttention',
              delta: 15
            }, {
              key: 'chatRecognition',
              delta: 20
            }, {
              key: 'styleHumble',
              delta: 1
            }, {
              key: 'currentNodeId',
              value: 'E10'
            }],
            nextNodeId: 'E10'
          }]
        },
        E10: {
          id: 'E10',
          title: 'Become Top Supporter',
          roomTitle: 'Nana的深夜闲聊',
          moodLabel: '气氛：忠诚',
          nanaLine: '我很难继续装中立了。现在这个房间，确实都在看你。',
          chatLines: ['system：榜单更新：新来的老板成为榜一。', 'tea_fan_12：新榜一确认。', 'oldfan_77：居然真的换人了。', 'hater_404：旧时代结束。', 'MoonlitBoss：这次你赢了。'],
          powerTopicUnlocked: true,
          choices: [{
            id: 'accept_top',
            label: '接受榜一身份',
            nanaLine: '别太得意。榜一只是开始，房间会盯着你怎么用这个位置。',
            chatLines: ['你：接受榜一身份', 'tea_fan_12：发言发言。', 'oldfan_77：看他下一步。', 'hater_404：新王上任。', 'Qing[房管]：别滥用权限。'],
            stateChanges: [{
              key: 'currentNodeId',
              value: 'E11'
            }],
            nextNodeId: 'E11'
          }]
        },
        E11: {
          id: 'E11',
          title: 'Punishment Power Unlock',
          roomTitle: 'Nana的深夜闲聊',
          moodLabel: '气氛：忠诚',
          nanaLine: '挑战输了就要认。给你一次房间安全范围内的惩罚权。',
          chatLines: ['system：权力解锁：决定惩罚。', 'tea_fan_12：选标题！选标题！', 'oldfan_77：不要太过分。', 'hater_404：这按钮终于危险起来了。', 'Qing[房管]：我会否决越线选项。'],
          powerTopicUnlocked: true,
          choices: [{
            id: 'embarrassing_compliment',
            label: '读最羞耻夸夸',
            nanaLine: '你们写的夸夸为什么像战书？我只读一遍。',
            chatLines: ['你：读最羞耻夸夸', 'tea_fan_12：主播脸红了？', 'hater_404：营业事故。', 'Qing[房管]：下一条太过，删了。', 'system：惩罚执行中。'],
            stateChanges: [{
              key: 'streamerAttention',
              delta: 10
            }, {
              key: 'haterHeat',
              delta: 8
            }, {
              key: 'styleDominant',
              delta: 1
            }, {
              key: 'currentNodeId',
              value: 'E12'
            }],
            nextNodeId: 'E12'
          }, {
            id: 'qing_line',
            label: '让 Qing 写下一句台词',
            nanaLine: 'Qing 写？你们两个今天是不是联合起来整我。',
            chatLines: ['你：让 Qing 写下一句台词', 'Qing[房管]：我写得比弹幕安全。', 'oldfan_77：房管终于上桌。', 'hater_404：Qing掌权的一分钟。', 'system：惩罚执行中。'],
            stateChanges: [{
              key: 'moderatorTrust',
              delta: 15
            }, {
              key: 'streamerAttention',
              delta: 8
            }, {
              key: 'styleHumble',
              delta: 1
            }, {
              key: 'currentNodeId',
              value: 'E12'
            }],
            nextNodeId: 'E12'
          }, {
            id: 'room_title_vote',
            label: '把房间标题交给弹幕',
            nanaLine: '把标题交给弹幕？这不是惩罚，这是灾难预告。',
            chatLines: ['你：把房间标题交给弹幕', 'tea_fan_12：新时代！', 'hater_404：标题战争开始。', 'oldfan_77：别太丢人。', 'Qing[房管]：我只保留安全标题。'],
            stateChanges: [{
              key: 'streamerAttention',
              delta: 10
            }, {
              key: 'haterHeat',
              delta: 10
            }, {
              key: 'styleChaos',
              delta: 1
            }, {
              key: 'currentNodeId',
              value: 'E12'
            }],
            nextNodeId: 'E12'
          }]
        },
        E12: {
          id: 'E12',
          title: 'Room Title Vote',
          roomTitle: 'Nana的深夜闲聊',
          moodLabel: '气氛：混乱',
          nanaLine: '标题只能从安全名单里选。你们不要逼 Qing 加班。',
          chatLines: ['system：房间标题投票开始。', 'tea_fan_12：新老板时代！', 'hater_404：Nana假装不在乎。', 'oldfan_77：这个标题至少能看。', 'Qing[房管]：过线标题已删除。'],
          powerTopicUnlocked: true,
          choices: [{
            id: 'new_boss_era',
            label: '新老板时代',
            nanaLine: '新老板时代？你们是真的想让我明天被老粉审判。',
            chatLines: ['你：选择「新老板时代」', 'tea_fan_12：新老板时代！', 'hater_404：旧王退位。', 'MoonlitBoss：标题不错。', 'system：房间标题已变更。'],
            stateChanges: [{
              key: 'finalTitle',
              value: '新老板时代'
            }, {
              key: 'playerStatus',
              value: 'room_core'
            }, {
              key: 'chatRecognition',
              value: 100
            }, {
              key: 'roomMood',
              value: 'chaotic'
            }, {
              key: 'styleDominant',
              delta: 1
            }, {
              key: 'currentNodeId',
              value: 'E13'
            }],
            nextNodeId: 'E13'
          }, {
            id: 'nana_not_care',
            label: 'Nana假装不在乎',
            nanaLine: '我没有假装。好吧，也许有一点。',
            chatLines: ['你：选择「Nana假装不在乎」', 'tea_fan_12：她承认了。', 'oldfan_77：这个有房间味。', 'hater_404：嘴硬标题。', 'system：房间标题已变更。'],
            stateChanges: [{
              key: 'finalTitle',
              value: 'Nana假装不在乎'
            }, {
              key: 'playerStatus',
              value: 'room_core'
            }, {
              key: 'chatRecognition',
              value: 100
            }, {
              key: 'roomMood',
              value: 'chaotic'
            }, {
              key: 'styleHumble',
              delta: 1
            }, {
              key: 'currentNodeId',
              value: 'E13'
            }],
            nextNodeId: 'E13'
          }, {
            id: 'qing_overtime',
            label: 'Qing加班房',
            nanaLine: 'Qing加班房？这个标题是不是对房管太残忍了。',
            chatLines: ['你：选择「Qing加班房」', 'Qing[房管]：我拒绝但记录。', 'hater_404：房管工伤标题。', 'tea_fan_12：今晚最合理。', 'system：房间标题已变更。'],
            stateChanges: [{
              key: 'finalTitle',
              value: 'Qing加班房'
            }, {
              key: 'playerStatus',
              value: 'room_core'
            }, {
              key: 'chatRecognition',
              value: 100
            }, {
              key: 'roomMood',
              value: 'chaotic'
            }, {
              key: 'styleChaos',
              delta: 1
            }, {
              key: 'currentNodeId',
              value: 'E13'
            }],
            nextNodeId: 'E13'
          }]
        },
        E13: {
          id: 'E13',
          title: 'Room Title Changes',
          roomTitle: '新老板时代',
          moodLabel: '气氛：混乱',
          nanaLine: '看到了吗？标题真改了。今天这个锅，算你们和新老板一起背。',
          chatLines: ['system：Clip 标记第二次闪烁。', 'tea_fan_12：标题真的变了！', 'hater_404：新老板时代刷起来。', 'oldfan_77：这房间回不去了。', 'Qing[房管]：标题已记录，别继续改。'],
          powerTopicUnlocked: true,
          choices: [{
            id: 'continue_speech',
            label: '发表最后一句',
            nanaLine: '最后给你一句话。说完我就下播，不然 Qing 真要加班。',
            chatLines: ['system：最终发言开始。', 'tea_fan_12：老板讲话！', 'hater_404：麦克风递过去。', 'oldfan_77：看他说什么。', 'Qing[房管]：最后一句。'],
            stateChanges: [{
              key: 'currentNodeId',
              value: 'E14'
            }],
            nextNodeId: 'E14'
          }]
        },
        E14: {
          id: 'E14',
          title: 'Boss Speech',
          roomTitle: '新老板时代',
          moodLabel: '气氛：混乱',
          nanaLine: '全房间都在等你。别说太长，我怕你越说越像真的老板。',
          chatLines: ['system：选择你的最终发言。', 'tea_fan_12：说点好的。', 'oldfan_77：别太装。', 'hater_404：登基稿准备。', 'Qing[房管]：文明发言。'],
          powerTopicUnlocked: true,
          choices: [{
            id: 'humble_speech',
            label: '今晚是大家一起撑起来的',
            nanaLine: '你让房间更吵，但没有变坏。这比有钱少见。',
            chatLines: ['你：今晚是大家一起撑起来的', 'tea_fan_12：好老板。', 'oldfan_77：这句我认。', 'hater_404：居然收得住。', 'system：结算路线：温和榜一。'],
            stateChanges: [{
              key: 'styleHumble',
              delta: 1
            }, {
              key: 'currentNodeId',
              value: 'E15'
            }],
            nextNodeId: 'E15'
          }, {
            id: 'dominant_speech',
            label: '从今晚开始，房间记住我',
            nanaLine: '你真的走进来就改了房间秩序。别明天开始建王朝。',
            chatLines: ['你：从今晚开始，房间记住我', 'tea_fan_12：新时代。', 'oldfan_77：太嚣张了。', 'hater_404：老粉震动。', 'system：结算路线：强势榜一。'],
            stateChanges: [{
              key: 'styleDominant',
              delta: 1
            }, {
              key: 'currentNodeId',
              value: 'E15'
            }],
            nextNodeId: 'E15'
          }, {
            id: 'chaos_speech',
            label: '别问我怎么赢的，问弹幕',
            nanaLine: '我不知道你是救了房间还是拆了房间，但至少没人无聊。',
            chatLines: ['你：别问我怎么赢的，问弹幕', 'tea_fan_12：剪这个！', 'hater_404：全员共犯。', 'Qing[房管]：我今晚确实加班。', 'system：结算路线：混乱榜一。'],
            stateChanges: [{
              key: 'styleChaos',
              delta: 1
            }, {
              key: 'currentNodeId',
              value: 'E15'
            }],
            nextNodeId: 'E15'
          }]
        },
        E15: {
          id: 'E15',
          title: 'Ending Summary',
          roomTitle: '新老板时代',
          moodLabel: '气氛：结算',
          nanaLine: '十五分钟，从没人理你到全房间等你说话。你今晚确实留下来了。',
          chatLines: ['system：15分钟切片完成。', 'system：身份：房间核心。', 'system：是否愿意分享这段 Clip？', 'tea_fan_12：下次还来吗？', 'Qing[房管]：下播。'],
          powerTopicUnlocked: true,
          choices: [{
            id: 'replay',
            label: '重新测试完整 E00-E15',
            nanaLine: '重来？行，我假装第一次见你。',
            chatLines: ['system：重置完整流程。', 'oldfan_77：时间线重启。', 'hater_404：又来？', 'Qing[房管]：测试模式。', 'tea_fan_12：再看一遍。'],
            stateChanges: [{
              key: 'playerStatus',
              value: 'nobody'
            }, {
              key: 'streamerAttention',
              value: 0
            }, {
              key: 'chatRecognition',
              value: 0
            }, {
              key: 'oldFanJealousy',
              value: 0
            }, {
              key: 'haterHeat',
              value: 0
            }, {
              key: 'moderatorTrust',
              value: 0
            }, {
              key: 'styleHumble',
              value: 0
            }, {
              key: 'styleDominant',
              value: 0
            }, {
              key: 'styleChaos',
              value: 0
            }, {
              key: 'roomMood',
              value: 'cold'
            }, {
              key: 'finalTitle',
              value: 'Nana的深夜闲聊'
            }, {
              key: 'currentNodeId',
              value: 'E00'
            }],
            nextNodeId: 'E00'
          }]
        }
      };

      _export("Day1LivestreamRoom", Day1LivestreamRoom = (_dec = ccclass('Day1LivestreamRoom'), _dec(_class = class Day1LivestreamRoom extends Component {
        constructor(...args) {
          super(...args);
          this.width = 750;
          this.height = 1334;
          this.root = null;
          this.state = this.createInitialState();
          this.overrideNanaLine = null;
          this.overrideChatLines = null;
        }

        start() {
          log('[Slice] Day1LivestreamRoom started');
          this.resetCanvas();
          this.buildRoom();
        }

        createInitialState() {
          return {
            playerStatus: 'nobody',
            streamerAttention: 0,
            chatRecognition: 0,
            oldFanJealousy: 0,
            haterHeat: 0,
            moderatorTrust: 0,
            styleHumble: 0,
            styleDominant: 0,
            styleChaos: 0,
            roomMood: 'cold',
            finalTitle: 'Nana的深夜闲聊',
            currentNodeId: 'E00'
          };
        }

        get currentEvent() {
          var _EVENTS$this$state$cu;

          return (_EVENTS$this$state$cu = EVENTS[this.state.currentNodeId]) != null ? _EVENTS$this$state$cu : EVENTS.E00;
        }

        resetCanvas() {
          var _hostNode$getComponen;

          const hostNode = this.getRenderHostNode();
          const transform = (_hostNode$getComponen = hostNode.getComponent(UITransform)) != null ? _hostNode$getComponen : hostNode.addComponent(UITransform);
          transform.setContentSize(new Size(this.width, this.height));
          const existingRoot = hostNode.getChildByName('Day1Root');

          if (existingRoot) {
            existingRoot.destroy();
          }

          this.root = new Node('Day1Root');
          this.syncLayer(this.root, hostNode);
          hostNode.addChild(this.root);
          this.root.setPosition(new Vec3(0, 0, 0));
          const rootTransform = this.root.addComponent(UITransform);
          rootTransform.setContentSize(new Size(this.width, this.height));
        }

        getRenderHostNode() {
          const runtimeNode = this.node;

          if (runtimeNode.name === 'Camera' && runtimeNode.parent) {
            return runtimeNode.parent;
          }

          return this.node;
        }

        buildRoom() {
          this.createRectNode('Background', 0, 0, this.width, this.height, {
            fill: new Color(22, 24, 32, 255)
          });
          this.buildTopBar();
          this.buildSupporterStrip();
          this.buildStreamerStage();
          this.buildPlayerStatus();
          this.buildChatPanel();
          this.buildPowerRow();
          this.buildChoicePanel();
        }

        buildTopBar() {
          const y = 632;
          const event = this.currentEvent;
          const topBar = this.createRectNode('TopBar', 0, y, 726, 76, {
            fill: new Color(37, 40, 54, 255),
            stroke: new Color(77, 83, 110, 255)
          });
          this.createLabel(topBar, 'RoomTitleLabel', this.getRoomTitle(event), -220, 12, 28, new Color(245, 221, 151, 255), 300);
          this.createLabel(topBar, 'MoodLabel', event.moodLabel, 96, 12, 22, new Color(180, 203, 255, 255), 160);
          this.createLabel(topBar, 'ClipLabel', `${event.id}: ${event.title}`, 230, -18, 18, new Color(148, 154, 174, 255), 190);
        }

        buildSupporterStrip() {
          const y = 544;
          const strip = this.createRectNode('SupporterStrip', 0, y, 726, 88, {
            fill: new Color(31, 34, 45, 255),
            stroke: new Color(67, 73, 96, 255)
          });
          this.createLabel(strip, 'Rank1Label', this.getRankOneLabel(), -206, 18, 22, new Color(255, 218, 116, 255), 260);
          this.createLabel(strip, 'Rank2Label', this.getRankTwoLabel(), 36, 18, 22, new Color(220, 225, 242, 255), 210);
          const playerRank = this.state.playerStatus === 'nobody' ? '你：未上榜' : `你：${this.getPlayerRankLabel()}`;
          this.createLabel(strip, 'PlayerRankLabel', playerRank, 234, -18, 22, new Color(147, 220, 255, 255), 190);
        }

        buildStreamerStage() {
          var _this$overrideNanaLin;

          const y = 260;
          const event = this.currentEvent;
          const stage = this.createRectNode('StreamerStage', 0, y, 726, 456, {
            fill: new Color(42, 37, 50, 255),
            stroke: new Color(89, 77, 112, 255)
          });
          this.createRectNode('NanaPlaceholder', 0, 72, 260, 260, {
            fill: new Color(72, 63, 88, 255),
            stroke: new Color(236, 174, 217, 255)
          }, stage);
          this.createLabel(stage, 'NanaAvatarText', 'Nana Avatar', 0, 72, 28, new Color(244, 199, 232, 255), 220);
          this.createLabel(stage, 'NanaNameLabel', 'Nana', -286, -126, 26, new Color(255, 229, 249, 255), 120);
          const bubble = this.createRectNode('NanaLineBubble', 78, -138, 520, 104, {
            fill: new Color(31, 28, 38, 255),
            stroke: new Color(128, 96, 144, 255)
          }, stage);
          this.createLabel(bubble, 'NanaLineLabel', (_this$overrideNanaLin = this.overrideNanaLine) != null ? _this$overrideNanaLin : event.nanaLine, 0, 0, 22, new Color(243, 239, 249, 255), 480);
        }

        buildPlayerStatus() {
          const y = -4;
          const row = this.createRectNode('PlayerStatusRow', 0, y, 726, 82, {
            fill: new Color(33, 37, 47, 255),
            stroke: new Color(70, 81, 103, 255)
          });
          this.createLabel(row, 'BadgeLabel', PLAYER_STATUS_LABELS[this.state.playerStatus], -260, 16, 24, new Color(255, 221, 126, 255), 180);
          this.createLabel(row, 'InfluenceLabel', `房间影响力 ${this.state.chatRecognition}`, -38, 16, 22, new Color(208, 221, 255, 255), 190);
          this.createRectNode('InfluenceBarBack', 176, -18, 260, 16, {
            fill: new Color(20, 23, 31, 255),
            stroke: new Color(82, 91, 116, 255)
          }, row);
        }

        buildChatPanel() {
          const y = -220;
          const event = this.currentEvent;
          const panel = this.createRectNode('ChatPanel', 0, y, 726, 310, {
            fill: new Color(26, 29, 38, 255),
            stroke: new Color(60, 67, 88, 255)
          });
          this.createLabel(panel, 'ChatTitle', 'Live Chat', -296, 126, 20, new Color(156, 198, 255, 255), 120);
          const lines = this.getChatLines(event);
          lines.slice(0, 5).forEach((text, index) => {
            this.createLabel(panel, `ChatLine0${index + 1}`, text, -10, 78 - index * 46, 22, this.getChatLineColor(text), 650);
          });
        }

        buildPowerRow() {
          const y = -424;
          const topicUnlocked = this.currentEvent.powerTopicUnlocked === true;
          const row = this.createRectNode('PowerRow', 0, y, 726, 84, {
            fill: new Color(33, 35, 47, 255),
            stroke: new Color(68, 75, 100, 255)
          });
          this.createButton(row, 'PowerButtonTopic', topicUnlocked ? '改话题 可用' : '改话题 锁定', -236, 0, 206, 52, topicUnlocked, () => {
            log('[Slice] power button clicked: Change Topic');
          });
          this.createButton(row, 'PowerButtonName', this.state.playerStatus === 'top_supporter' || this.state.playerStatus === 'room_core' ? '惩罚 可用' : '点名 锁定', 0, 0, 206, 52, this.state.playerStatus === 'top_supporter' || this.state.playerStatus === 'room_core');
          this.createButton(row, 'PowerButtonChallenge', this.state.playerStatus === 'room_core' ? '改标题 已用' : '挑战卡 锁定', 236, 0, 206, 52, false);
        }

        buildChoicePanel() {
          const y = -572;
          const choices = this.currentEvent.choices;
          const panel = this.createRectNode('ChoicePanel', 0, y, 726, 200, {
            fill: new Color(28, 31, 42, 255),
            stroke: new Color(76, 84, 112, 255)
          });
          const positions = [58, 0, -58];

          for (let index = 0; index < 3; index += 1) {
            const choice = choices[index];
            this.createButton(panel, `ChoiceButton${index + 1}`, choice ? choice.label : '', 0, positions[index], 660, 46, Boolean(choice), choice ? () => this.selectChoice(choice) : undefined);
          }
        }

        selectChoice(choice) {
          log(`[Slice] ${this.state.currentNodeId} -> ${choice.nextNodeId}: ${choice.id}`);

          for (const change of choice.stateChanges) {
            this.applyStateChange(change);
          }

          this.state.currentNodeId = choice.nextNodeId;
          this.overrideNanaLine = choice.nanaLine;
          this.overrideChatLines = choice.chatLines;
          this.resetCanvas();
          this.buildRoom();
        }

        applyStateChange(change) {
          if (change.value !== undefined) {
            this.setStateValue(change.key, change.value);
            return;
          }

          if (change.delta !== undefined) {
            const current = this.state[change.key];

            if (typeof current === 'number') {
              this.setStateValue(change.key, this.clamp(current + change.delta, 0, 100));
            }
          }
        }

        setStateValue(key, value) {
          switch (key) {
            case 'playerStatus':
              this.state.playerStatus = value;
              break;

            case 'streamerAttention':
              this.state.streamerAttention = value;
              break;

            case 'chatRecognition':
              this.state.chatRecognition = value;
              break;

            case 'oldFanJealousy':
              this.state.oldFanJealousy = value;
              break;

            case 'haterHeat':
              this.state.haterHeat = value;
              break;

            case 'moderatorTrust':
              this.state.moderatorTrust = value;
              break;

            case 'styleHumble':
              this.state.styleHumble = value;
              break;

            case 'styleDominant':
              this.state.styleDominant = value;
              break;

            case 'styleChaos':
              this.state.styleChaos = value;
              break;

            case 'roomMood':
              this.state.roomMood = value;
              break;

            case 'finalTitle':
              this.state.finalTitle = value;
              break;

            case 'currentNodeId':
              this.state.currentNodeId = value;
              break;
          }
        }

        getPlayerRankLabel() {
          if (this.state.playerStatus === 'familiar_face') {
            return '12. 新来的老板 30';
          }

          if (this.state.playerStatus === 'room_regular') {
            return '6. 新来的老板 260';
          }

          if (this.state.playerStatus === 'contender') {
            return '2. 新来的老板 7600';
          }

          if (this.state.playerStatus === 'top_supporter' || this.state.playerStatus === 'room_core') {
            return '1. 新来的老板 12000';
          }

          return '未上榜';
        }

        getRankOneLabel() {
          if (this.state.playerStatus === 'top_supporter' || this.state.playerStatus === 'room_core') {
            return '1. 新来的老板 12000';
          }

          return '1. MoonlitBoss 9999';
        }

        getRankTwoLabel() {
          if (this.state.playerStatus === 'top_supporter' || this.state.playerStatus === 'room_core') {
            return '2. MoonlitBoss 9999';
          }

          return '2. StarTea 4200';
        }

        getRoomTitle(event) {
          if (this.state.playerStatus === 'room_core' || this.state.currentNodeId === 'E13' || this.state.currentNodeId === 'E14' || this.state.currentNodeId === 'E15') {
            return this.state.finalTitle;
          }

          return event.roomTitle;
        }

        getChatLines(event) {
          if (this.overrideChatLines) {
            return this.overrideChatLines;
          }

          if (event.id === 'E15') {
            return ['system：15分钟切片完成。', `system：身份 ${PLAYER_STATUS_LABELS[this.state.playerStatus]} / 标题「${this.state.finalTitle}」`, `system：影响 ${this.state.chatRecognition} / Qing信任 ${this.state.moderatorTrust}`, `system：嫉妒 ${this.state.oldFanJealousy} / 黑粉热度 ${this.state.haterHeat}`, `system：结算路线：${this.getEndingStyleLabel()}`];
          }

          return event.chatLines;
        }

        getEndingStyleLabel() {
          if (this.state.styleChaos >= this.state.styleDominant && this.state.styleChaos >= this.state.styleHumble) {
            return '混乱榜一';
          }

          if (this.state.styleDominant >= this.state.styleHumble) {
            return '强势榜一';
          }

          return '温和榜一';
        }

        getChatLineColor(text) {
          if (text.includes('hater_') || text.includes('裂开') || text.includes('秩序')) {
            return new Color(255, 150, 126, 255);
          }

          if (text.includes('oldfan_') || text.includes('以前') || text.includes('不安')) {
            return new Color(199, 184, 242, 255);
          }

          if (text.includes('Qing') || text.includes('房管')) {
            return new Color(137, 189, 255, 255);
          }

          if (text.includes('system') || text.includes('任务') || text.includes('身份升级')) {
            return new Color(255, 221, 126, 255);
          }

          if (text.includes('你：')) {
            return new Color(147, 220, 255, 255);
          }

          return new Color(218, 223, 236, 255);
        }

        clamp(value, min, max) {
          return Math.max(min, Math.min(max, value));
        }

        createButton(parent, name, text, x, y, w, h, enabled, onClick) {
          const buttonNode = this.createRectNode(name, x, y, w, h, {
            fill: enabled ? new Color(68, 78, 112, 255) : new Color(44, 47, 59, 255),
            stroke: enabled ? new Color(125, 154, 231, 255) : new Color(82, 87, 106, 255)
          }, parent);
          const button = buttonNode.addComponent(Button);
          button.interactable = enabled;

          if (enabled) {
            buttonNode.on(Button.EventType.CLICK, () => {
              onClick == null || onClick();
            });
          }

          this.createLabel(buttonNode, `${name}Label`, text, 0, 0, 22, enabled ? new Color(246, 248, 255, 255) : new Color(139, 145, 162, 255), w - 24);
        }

        createRectNode(name, x, y, w, h, style, parent = (_this$root => (_this$root = this.root) != null ? _this$root : this.node)()) {
          const node = new Node(name);
          this.syncLayer(node, parent);
          parent.addChild(node);
          node.setPosition(new Vec3(x, y, 0));
          const transform = node.addComponent(UITransform);
          transform.setContentSize(new Size(w, h));
          const graphics = node.addComponent(Graphics);
          graphics.fillColor = style.fill;

          if (style.stroke) {
            graphics.strokeColor = style.stroke;
            graphics.lineWidth = 2;
          }

          const halfW = w / 2;
          const halfH = h / 2;
          graphics.rect(-halfW, -halfH, w, h);
          graphics.fill();

          if (style.stroke) {
            graphics.stroke();
          }

          return node;
        }

        createLabel(parent, name, text, x, y, fontSize, color, width) {
          const node = new Node(name);
          this.syncLayer(node, parent);
          parent.addChild(node);
          node.setPosition(new Vec3(x, y, 0));
          const transform = node.addComponent(UITransform);
          transform.setContentSize(new Size(width, fontSize * 2.6));
          const label = node.addComponent(Label);
          label.string = text;
          label.fontSize = fontSize;
          label.lineHeight = Math.ceil(fontSize * 1.25);
          label.color = color;
          label.horizontalAlign = Label.HorizontalAlign.CENTER;
          label.verticalAlign = Label.VerticalAlign.CENTER;
          label.overflow = Label.Overflow.SHRINK;
          label.enableWrapText = true;
          return label;
        }

        syncLayer(node, parent) {
          const parentLayer = parent.layer;

          if (parentLayer !== undefined) {
            node.layer = parentLayer;
          }
        }

      }) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=35cc0b6362c7ba315b651b843d956a030b71c792.js.map