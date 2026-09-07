import React, { useState, useEffect } from 'react';
import { auth, db, appInstance } from '../cloudbase';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Star } from 'lucide-react';
import AIChatOnboarding from './AIChatOnboarding';
import { callAIEmbedding } from '../services/aiService';

const COLLEGES = [
  '哲学社会学院', '经济学院', '法学院', '政治与国际关系学院', '马克思主义学院', '文学院', '外国语学院', '新闻与传播学院', '历史文化学院', '管理学院', '艺术学院', '威尔士学院', '数学与统计学院', '物理科学与技术学院', '化学化工学院', '资源环境学院', '大气科学学院', '地质科学与矿产资源学院', '生命科学学院', '土木工程与力学学院', '材料与能源学院', '信息科学与工程学院', '核科学与技术学院', '草地农业科技学院', '动物医学与生物安全学院', '基础医学院', '口腔医学院（口腔医院）', '公共卫生学院', '药学院', '护理学院', '第一临床医学院', '第二临床医学院', '萃英学院', '国际文化交流学院', '体育教研部', '其他'
];

const PROVINCES = [
  '北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江', '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '广西', '海南', '重庆', '四川', '贵州', '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆', '台湾', '香港', '澳门', '海外'
];

const TRAITS = [
  '充满好奇心', '诚实正直', '聪明智慧', '温柔善良', '乐观开朗', '有勇气', '有创造力', '高度自律', '顾家', '独立', '忠诚', '幽默风趣', '经世致用', '坚韧务实',
  '有野心，有领导力', '温和包容', '深思熟虑', '乐观敏捷', '勤奋自律', '松弛随性', '爱冒险', '踏实求稳', '爱照顾人', '乐于被照顾'
];

const SELF_LABELS = [
  '热情高能', '文艺有品', '酷帅独立', '纯真害羞', '温柔好脾气', '低调沉稳'
];

const COMMON_FLAWS = [
  '不修边幅', '不擅整理', '爱打游戏', '日夜颠倒', '经常迟到', '说话太直', '容易情绪化', '花钱大手大脚', '不爱社交', '做事拖延'
];

const RISK_BEHAVIORS = [
  '吵架后长期不理人', '和前任保持联系', '不擅规划财务', '不主动分担共同事务', '对对方的朋友和家人冷淡', '让朋友评判对方', '因学业或游戏放鸽子'
];

const CORE_PRIORITIES = [
  '道德善良', '智力水平', '外形条件', '情绪价值', '性格稳定', '经济条件'
];

const FUTURE_LOCATIONS = [
  '武汉长沙', '成都重庆','北京', '江浙沪', '大湾区', '美国', '欧洲', '其他'
];

const SCHOOL_STAGES = ['本科', '研究生', '都可以'];

const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
  '还不确定'
];

const INTUITION_SCENARIOS = {
  idealThing: [
    '一个人去爬山或骑行，享受独处时光',
    '逛博物馆或看展，充实自己',
    '在家看书或追剧，安静宅着',
    '和几个好朋友约饭聊天'
  ],
  lateReaction: [
    '刷手机消磨时间，不催也不急',
    '反复发消息问到哪了',
    '强迫自己不去催，但会反复看手机',
    '略有不快，态度变冷淡'
  ],
  recentStatusReply: [
    '直接说挺好的，简洁带过',
    '分享最近发生的一件事',
    '认真说说自己的状态和感受',
    '反问对方，了解对方近况'
  ],
  postConflictAction: [
    '必须当晚解决，睡不睡觉无所谓',
    '先冷静一下，明天再谈',
    '发消息说今天累了，回头再说',
    '等对方先开口，自己需要台阶'
  ],
  relationshipNeed: [
    '对方懂我，哪怕不说也能理解',
    '和对方在一起会心动，做什么都兴奋',
    '对方靠谱，可以托付未来',
    '和对方在一起很舒服，自由自在'
  ]
};

const HOBBIES = [
  { category: '户外与运动', tags: ['跑步', '健身', '篮球', '足球', '羽毛球', '乒乓球', '游泳', '骑行', '徒步', '飞盘', '滑板', '球类运动', '跳舞'] },
  { category: '泛娱乐与数字文化', tags: ['电子游戏', '追剧', '电影戏剧', '动漫', '综艺', '刷短视频', '剧本杀', '密室逃脱', '手机游戏', '电竞与电脑游戏'] },
  { category: '文艺与知识', tags: ['阅读', '写作', '绘画手工', '摄影', '音乐乐器', '哲学', '历史社科', '看展逛博物馆', '短视频记录'] },
  { category: '生活方式', tags: ['烹饪烘焙', '探店美食', '旅行', '猫狗宠物', '咖啡茶饮', '园艺', '手工'] },
  { category: '极客与硬核', tags: ['编程算法', '数码产品', '硬件改装与数码', '科幻', '天文', '科学探索', '军事', '金融投资', '开源与技术社区'] },
  { category: '兰大特色', tags: ['爬萃英山', '校园散步', '兰大民大吃小吃', '昆仑堂旁静坐', '榆中校区夜跑', '积石堂自习', '中山桥散步', '黄河边骑行'] }
];

const MODULES = [
  {
    id: 'basic',
    title: '基本信息',
    subtitle: '先让我们认识你。这些信息用于基础筛选，不会公开展示。',
    questions: [
      { id: 'name', type: 'input', label: '你的昵称', hint: '怎么称呼你？' },
      { id: 'bio', type: 'textarea', label: '个人简介', hint: '简单介绍一下你自己...' },
      { id: 'avatarUrl', type: 'image-upload', label: '上传头像 (可选)', optional: true },
      { id: 'gender', type: 'single', label: '你的性别', options: ['男', '女', '非二元'] },
      { id: 'mbti', type: 'single', label: '你的 MBTI（若知道）', options: MBTI_TYPES },
      { id: 'orientation', type: 'single', label: '你的性取向', options: ['异性恋', '同性恋', '双性恋', '其他'] },
      { id: 'grade', type: 'single', label: '你的年级', options: ['大一', '大二', '大三', '大四', '硕士', '博士'] },
      { id: 'preferredSchoolStage', type: 'single', label: '我希望对方在读阶段', options: SCHOOL_STAGES },
      { id: 'campus', type: 'single', label: '你住在哪个校区？', options: ['城关校区', '榆中校区'] },
      { id: 'college', type: 'select', label: '你的学院', options: COLLEGES },
      { id: 'height', type: 'slider', label: '你的身高', min: 140, max: 210, unit: 'cm' },
      { id: 'heightRange', type: 'range-input', label: '你能接受的匹配对象身高范围', min: 140, max: 210, unit: 'cm' },
      { id: 'province', type: 'select', label: '你的家乡省份', options: PROVINCES },
      { id: 'preferredProvinces', type: 'multi-tag', label: '希望对方来自哪里（可多选）', options: PROVINCES, maxTags: 3, optional: true },
      { id: 'crossCampus', type: 'single', label: '对于"跨校区恋爱"（如城关-榆中），你的态度是', options: ['可以接受', '不接受'], hint: '【提示】关于跨校区和同学院匹配：如果你选了"不接受"跨校区，我们会优先在你所在校区内匹配。' },
      { id: 'sameCollege', type: 'single', label: '对于"匹配到同学院的人"，你的态度是', options: ['接受', '不接受', '无所谓'] }
    ]
  },
  {
    id: 'career',
    title: '人生观与事业观',
    subtitle: '聚焦你在事业、财富和人生轨迹上的观念。若某道题对你特别重要，点击「☆ 设为重要」。',
    questions: [
      { id: 'careerAttitude', type: 'double-slider', label: '对待学业/事业的态度', leftLabel: '身心健康至上', rightLabel: '极度上进，全力以赴', min: 1, max: 7, canMarkImportant: true },
      { id: 'lifePath', type: 'slider', label: '毕业后更希望的生活轨迹', leftLabel: '回家乡或二三线城市', rightLabel: '扎根北上广深一线', min: 1, max: 7, canMarkImportant: true },
      { id: 'datingExpense', type: 'single', label: '恋爱日常开销倾向', options: ['接近AA制', '收入高的一方多承担', '男方多承担', '看情况灵活处理'], canMarkImportant: true },
      { id: 'monthlySpending', type: 'single', label: '我每月花销大约是多少', options: ['一千左右', '两千左右', '三千左右', '四千左右', '远超四千'], canMarkImportant: true },
      { id: 'futureLocations', type: 'multi-tag', label: '未来希望工作或深造的地点（可多选）', options: FUTURE_LOCATIONS, maxTags: 3, canMarkImportant: true },
      { id: 'marriageView', type: 'slider', label: '对未来婚姻的看法', leftLabel: '坚决不婚', rightLabel: '一定要结婚', min: 1, max: 7, canMarkImportant: true },
      { id: 'kindnessVsSmart', type: 'slider', label: '关键利益面前，善良比聪明更重要？', leftLabel: '强烈不同意', rightLabel: '强烈同意', min: 1, max: 7, canMarkImportant: true },
      { id: 'idealVsMaterial', type: 'slider', label: '愿意为理想信念放弃物质舒适？', leftLabel: '强烈不同意', rightLabel: '强烈同意', min: 1, max: 7, canMarkImportant: true },
      { id: 'moneyAttitude', type: 'slider', label: '你对金钱的核心态度', leftLabel: '安全感第一，能省则省', rightLabel: '体验至上，愿为品质付费', min: 1, max: 7, canMarkImportant: true }
    ]
  },
  {
    id: 'personality',
    title: '性格与价值观',
    subtitle: '了解你看待世界的方式——这决定了你和谁能深度共鸣。',
    questions: [
      { id: 'familyVsCareer', type: 'slider', label: '家庭幸福 vs 个人事业成功', leftLabel: '事业绝对优先', rightLabel: '家庭绝对优先', min: 1, max: 7, canMarkImportant: true },
      { id: 'processVsResult', type: 'slider', label: '更看重过程体验还是最终结果', leftLabel: '典型的结果导向', rightLabel: '典型的体验导向', min: 1, max: 7, canMarkImportant: true },
      { id: 'decisionMaking', type: 'double-slider', label: '做决策时更相信逻辑数据还是直觉感受', leftLabel: '极度感性', rightLabel: '极度理性', min: 1, max: 7, canMarkImportant: true },
      { id: 'tryNewThings', type: 'slider', label: '我喜欢尝试新事物', leftLabel: '强烈不同意', rightLabel: '强烈同意', min: 1, max: 7, canMarkImportant: true },
      { id: 'socialEnergy', type: 'double-slider', label: '社交能量与内外向', leftLabel: '极度外向', rightLabel: '极度内向', min: 1, max: 7, canMarkImportant: true },
      { id: 'conflictResponse', type: 'slider', label: '面对冲突的本能反应', leftLabel: '先冷静，回避交锋', rightLabel: '当下立刻沟通解决', min: 1, max: 7, canMarkImportant: true },
      { id: 'selfLabel', type: 'multi-tag', label: '最能代表我的词（最多2项）', options: SELF_LABELS, maxTags: 2 },
      { id: 'partnerLabel', type: 'multi-tag', label: '我最希望对方是什么样（最多2项）', options: SELF_LABELS, maxTags: 2, canMarkImportant: true },
      { id: 'idealThing', type: 'single', label: '凭直觉选：你最想做哪件事', options: INTUITION_SCENARIOS.idealThing },
      { id: 'lateReaction', type: 'single', label: '凭直觉选：对方迟到半小时，你会怎样', options: INTUITION_SCENARIOS.lateReaction },
      { id: 'recentStatusReply', type: 'single', label: '凭直觉选：朋友问你最近怎么样，你通常怎么回答', options: INTUITION_SCENARIOS.recentStatusReply },
      { id: 'postConflictAction', type: 'single', label: '凭直觉选：和对象吵架之后，你通常会怎么做', options: INTUITION_SCENARIOS.postConflictAction },
      { id: 'relationshipNeed', type: 'single', label: '凭直觉选：你觉得自己在感情里最需要什么', options: INTUITION_SCENARIOS.relationshipNeed }
    ]
  },
  {
    id: 'lifestyle',
    title: '生活方式',
    subtitle: '柴米油盐里的默契，比任何浪漫都更长久。',
    questions: [
      { id: 'sleepSchedule', type: 'slider', label: '日常作息节律', leftLabel: '重度夜猫子', rightLabel: '早起鸟', min: 1, max: 7, canMarkImportant: true },
      { id: 'partnerTidiness', type: 'slider', label: '伴侣在整洁方面比较随性，对我来说', leftLabel: '完全无法接受', rightLabel: '完全不在意', min: 1, max: 7, canMarkImportant: true },
      { id: 'dietPreference', type: 'slider', label: '在兰大的日常饮食更偏好', leftLabel: '几乎全在食堂解决', rightLabel: '频繁点外卖或出去吃', min: 1, max: 7, canMarkImportant: true },
      { id: 'spicyTolerance', type: 'slider', label: '饮食口味（辣的接受程度）', leftLabel: '一点辣都不行', rightLabel: '无辣不欢', min: 1, max: 7, canMarkImportant: true },
      { id: 'specialDiet', type: 'single', label: '特殊饮食要求', options: ['无特殊要求', '清真（不吃猪肉）', '素食', '其他'], canMarkImportant: true },
      { id: 'weekendDate', type: 'slider', label: '周末约会更倾向于', leftLabel: '校园内散步学习', rightLabel: '校园外游逛吃吃喝喝', min: 1, max: 7, canMarkImportant: true },
      { id: 'freeTimeTogether', type: 'slider', label: '希望空闲时间都和伴侣待在一起？', leftLabel: '需要独处充电', rightLabel: '希望时刻腻在一起', min: 1, max: 7, canMarkImportant: true },
      { id: 'travelStyle', type: 'slider', label: '旅行中迷路和意外比执行攻略更有趣？', leftLabel: '必须严格按攻略', rightLabel: '极度享受随性', min: 1, max: 7, canMarkImportant: true },
      { id: 'spendingStyle', type: 'slider', label: '平时的消费风格', leftLabel: '极度节俭', rightLabel: '喜欢品质生活', min: 1, max: 7, canMarkImportant: true },
      { id: 'studyLocation', type: 'single', label: '约自习，你首选哪里？', options: ['榆中昆仑堂图书馆', '城关积石堂', '秦岭堂', '天山堂', '咖啡馆', '其他', '不自习'] },
      { id: 'myFlaws', type: 'multi-tag', label: '我的小毛病（最多3项）', options: COMMON_FLAWS, maxTags: 3, optional: true },
      { id: 'partnerFlawBoundary', type: 'multi-tag', label: '我不太能接受对方的习惯（最多3项）', options: COMMON_FLAWS, maxTags: 3, canMarkImportant: true }
    ]
  },
  {
    id: 'intimate',
    title: '亲密关系观',
    subtitle: '关于爱情本身——诚实作答，才能匹配到真正合拍的人。',
    questions: [
      { id: 'smoking', type: 'double-slider', label: '吸烟/电子烟习惯', leftLabel: '从不', rightLabel: '经常', min: 1, max: 7, canMarkImportant: true },
      { id: 'drinking', type: 'double-slider', label: '饮酒习惯', leftLabel: '滴酒不沾', rightLabel: '经常喝酒', min: 1, max: 7, canMarkImportant: true },
      { id: 'messageAnxiety', type: 'slider', label: '伴侣几小时没回微信，会焦虑吗', leftLabel: '完全不会', rightLabel: '会非常焦虑', min: 1, max: 7, canMarkImportant: true },
      { id: 'ritualSense', type: 'slider', label: '恋爱中"仪式感"重要吗（纪念日/惊喜）', leftLabel: '极度务实', rightLabel: '非常看重仪式感', min: 1, max: 7, canMarkImportant: true },
      { id: 'oppositeSexFriend', type: 'slider', label: '伴侣有非常亲密的异性好友', leftLabel: '绝对不能接受', rightLabel: '完全信任', min: 1, max: 7, canMarkImportant: true },
      { id: 'interactionMode', type: 'slider', label: '亲密关系中的互动模式', leftLabel: '更倾向顺从配合', rightLabel: '更倾向掌握主导', min: 1, max: 7, canMarkImportant: true },
      { id: 'carePreference', type: 'slider', label: '恋爱中你更倾向于', leftLabel: '极度喜欢被照顾', rightLabel: '极度喜欢照顾人', min: 1, max: 7, canMarkImportant: true },
      { id: 'relationshipPace', type: 'slider', label: '和伴侣发展亲密关系的节奏', leftLabel: '确认关系后很快', rightLabel: '需要很长时间建立信任', min: 1, max: 7, canMarkImportant: true },
      { id: 'relationshipGoal', type: 'single', label: '我想在这里寻找什么', options: ['轻松陪伴关系', '聊得来的普通朋友', '认真交往的恋爱对象', '结婚对象'], canMarkImportant: true },
      { id: 'houseworkPreference', type: 'single', label: '未来结婚后，家务分工我更倾向于哪种方式', options: ['基本平分', '谁有空谁多做', '明确分工各司其职', '希望对方多承担'], canMarkImportant: true },
      { id: 'dateStyle', type: 'single', label: '我喜欢的约会方式', options: ['一起学习再吃饭', '散步聊天', '一起打游戏点外卖', '探店拍照记录生活'] },
      { id: 'datePlanning', type: 'single', label: '约会内容由谁规划', options: ['对方来规划', '对方提议我决定', '我提议对方决定', '由我来定'] },
      { id: 'datePayment', type: 'single', label: '约会时谁买单', options: ['我爱买单', '多数时候我来', '轮流买单或各付各的', '多数时候对方来', '对方买单也可以'] },
      { id: 'intimacyAcceptance', type: 'single', label: '我对亲密行为的接受程度', options: ['感情到了就行', '交往一两年后', '确认结婚对象后', '婚后'], canMarkImportant: true },
      { id: 'meetFrequency', type: 'single', label: '恋爱期间期待的线下见面频率', options: ['天天在一起', '一周三次左右', '一周一次', '十天半月一次'], canMarkImportant: true },
      { id: 'showAffection', type: 'slider', label: '愿意在社交媒体上"秀恩爱"吗', leftLabel: '恋爱很私密', rightLabel: '喜欢记录分享', min: 1, max: 7, canMarkImportant: true },
      { id: 'criticismResponse', type: 'slider', label: '伴侣指出你的问题时，你的本能反应', leftLabel: '先为自己辩解', rightLabel: '先试着理解TA的感受', min: 1, max: 7, canMarkImportant: true },
      { id: 'dependency', type: 'slider', label: '在关系中依赖伴侣对你来说', leftLabel: '很难完全信赖和依赖', rightLabel: '很自然，愿意依赖对方', min: 1, max: 7, canMarkImportant: true },
      { id: 'sameGenderFriendAcceptance', type: 'single', label: '关系稳定后，我对对方同性交友的接受度', options: ['一个都不能有', '有对象的可以', '如果也是我朋友可以', '有点介意但不干涉', '完全不介意'], canMarkImportant: true },
      { id: 'familyInfluence', type: 'single', label: '重大决定中，父母家庭对我的影响有多大', options: ['完全决定', '大部分影响', '一半一半', '影响较少', '基本不影响'], canMarkImportant: true },
      { id: 'timeAllocation', type: 'single', label: '目前阶段，我理想的时间分配是什么', options: ['全力投入学业', '学业为主娱乐为辅', '学习娱乐各占一半', '及格就行更重生活体验'], canMarkImportant: true },
      { id: 'myRiskBehaviors', type: 'multi-tag', label: '恋爱中，我可能出现哪些行为（可跳过）', options: RISK_BEHAVIORS, maxTags: 3, optional: true },
      { id: 'dealBreakers', type: 'multi-tag', label: '如果对方有以下情况，我会考虑分手（可跳过）', options: RISK_BEHAVIORS, maxTags: 3, optional: true, canMarkImportant: true }
    ]
  },
  {
    id: 'hobbies',
    title: '兴趣爱好',
    subtitle: '不限类别，选出 2-5 个你最核心的爱好。共同的爱好是最好的破冰话题。',
    questions: [
      { id: 'coreHobbies', type: 'multi-tag', label: '选出你的核心兴趣爱好', categories: HOBBIES, minTags: 2, maxTags: 5 },
      { id: 'similarHobbies', type: 'slider', label: '希望伴侣和自己有相似的兴趣爱好？', leftLabel: '更喜欢互补', rightLabel: '必须高度重合', min: 1, max: 7, canMarkImportant: true }
    ]
  },
  {
    id: 'appearance',
    title: '外貌气质与核心特质',
    subtitle: '最后一步——关于吸引力和你最看重的灵魂特质。',
    questions: [
      { id: 'appearanceType', type: 'double-slider', label: '整体外貌/气质类型', leftLabel: '阳光可爱，平易近人', rightLabel: '气场强大', min: 1, max: 7, canMarkImportant: true },
      { id: 'partnerAppearanceEffort', type: 'slider', label: '非常看重伴侣在穿搭外貌上投入的精力', leftLabel: '完全不在意', rightLabel: '非常看重', min: 1, max: 7, canMarkImportant: true },
      { id: 'corePriorities', type: 'multi-tag', label: '我最看重对方的哪些方面（选3项）', options: CORE_PRIORITIES, minTags: 3, maxTags: 3, canMarkImportant: true },
      { id: 'selfTraits', type: 'multi-tag', label: '你希望自己成为什么样的人', options: TRAITS, maxTags: 5 },
      { id: 'partnerTraits', type: 'multi-tag', label: '你最看重伴侣具备哪些特质', options: TRAITS, maxTags: 5, canMarkImportant: true },
      { id: 'appearanceWeight', type: 'slider', label: '总体而言，外貌在你择偶标准中的比重', leftLabel: '几乎不重要', rightLabel: '非常重要', min: 1, max: 7, canMarkImportant: true },
      { id: 'springActivity', type: 'single', label: '【收尾/选填】这个春天，你最想和匹配对象一起做什么？', options: ['爬萃英山看日落', '校园散步聊天', '学校附近吃吃喝喝', '昆仑堂一起自习', '校园草坪晒太阳'], optional: true }
    ]
  },
  {
    id: 'ai-persona',
    title: '你的专属AI分身',
    subtitle: '写一段展示面，然后和AI聊几句，让它学习你的聊天风格。',
    questions: [
      { id: 'displayProfile', type: 'textarea', label: '你的展示面', hint: '这是匹配成功后，对方会看到的关于你的介绍。请把你最想让TA看到的一面写出来，吸引TA的注意吧！' },
      { id: 'aiChat', type: 'ai-chat', label: '和AI聊聊', hint: '与AI聊天能帮助我们更好地了解你，从而为你匹配更合适的对象。同时，匹配成功后，对方可以先与你的AI分身聊天，实现零门槛破冰，看看你们是否合拍！' },
      { id: 'wechat', type: 'input', label: '您愿意向TA展示您的微信号吗（选填）', hint: '这完全取决于您', optional: true }
    ]
  }
];

const INITIAL_FORM_DATA = {
  name: '', bio: '', avatarUrl: '', gender: '', mbti: '', orientation: '', grade: '', campus: '', college: '', height: 170, heightRange: { min: 150, max: 190 }, province: '', crossCampus: '', sameCollege: '',
  preferredSchoolStage: '', preferredProvinces: [],
  careerAttitude: { self: 4, partner: 4 }, lifePath: 4, datingExpense: '', monthlySpending: '', futureLocations: [], marriageView: 4, kindnessVsSmart: 4, idealVsMaterial: 4, moneyAttitude: 4,
  familyVsCareer: 4, processVsResult: 4, decisionMaking: { self: 4, partner: 4 }, tryNewThings: 4, socialEnergy: { self: 4, partner: 4 }, conflictResponse: 4, selfLabel: [], partnerLabel: [], idealThing: '', lateReaction: '', recentStatusReply: '', postConflictAction: '', relationshipNeed: '',
  sleepSchedule: 4, partnerTidiness: 4, dietPreference: 4, spicyTolerance: 4, specialDiet: '', weekendDate: 4, freeTimeTogether: 4, travelStyle: 4, spendingStyle: 4, studyLocation: '', myFlaws: [], partnerFlawBoundary: [],
  smoking: { self: 4, partner: 4 }, drinking: { self: 4, partner: 4 }, messageAnxiety: 4, ritualSense: 4, oppositeSexFriend: 4, interactionMode: 4, carePreference: 4, relationshipPace: 4, relationshipGoal: '', houseworkPreference: '', dateStyle: '', datePlanning: '', datePayment: '', intimacyAcceptance: '', meetFrequency: '', showAffection: 4, criticismResponse: 4, dependency: 4, sameGenderFriendAcceptance: '', familyInfluence: '', timeAllocation: '', myRiskBehaviors: [], dealBreakers: [],
  coreHobbies: [], similarHobbies: 4,
  appearanceType: { self: 4, partner: 4 }, partnerAppearanceEffort: 4, corePriorities: [], selfTraits: [], partnerTraits: [], appearanceWeight: 4, springActivity: '',
  displayProfile: '', aiSummary: '', wechat: ''
};

const ALL_ITEMS = MODULES.flatMap((m, mIndex) => [
  {
    isModuleIntro: true,
    id: `intro-${m.id}`,
    moduleId: m.id,
    moduleTitle: m.title,
    moduleSubtitle: m.subtitle,
    moduleIndex: mIndex
  },
  ...m.questions.map(q => ({
    ...q,
    isModuleIntro: false,
    moduleId: m.id,
    moduleTitle: m.title,
    moduleSubtitle: m.subtitle,
    moduleIndex: mIndex
  }))
]);

export default function Onboarding() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasExistingData, setHasExistingData] = useState(false);
  
  const [formData, setFormData] = useState<any>(INITIAL_FORM_DATA);
  const [importantQuestions, setImportantQuestions] = useState<string[]>([]);

  useEffect(() => {
    const checkProfile = async () => {
      const loginState = await auth.getLoginState();
      if (!loginState) {
        navigate('/');
        return;
      }
      try {
        const res = await db.collection('users').doc(auth.currentUser?.uid).get();
        if (res.data && res.data.length > 0 && res.data[0].onboardingCompleted) {
          const data = res.data[0];
          if (data.questionnaire) {
            setFormData({ ...INITIAL_FORM_DATA, ...data.questionnaire });
            setImportantQuestions(data.importantQuestions || []);
          }
          setHasExistingData(true);
        }
        setLoading(false);
      } catch (err) {
        console.error("Error checking profile:", err);
        setLoading(false);
      }
    };
    checkProfile();
  }, [navigate]);

  const toggleImportant = (qId: string) => {
    setImportantQuestions(prev => 
      prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId]
    );
  };

  const validateCurrentQuestion = () => {
    const q = ALL_ITEMS[currentIndex];
    if (q.isModuleIntro) return null;
    if (q.optional) return null;
    
    const val = formData[q.id];
    if (q.type === 'single' || q.type === 'select' || q.type === 'input' || q.type === 'textarea') {
      if (!val || (typeof val === 'string' && val.trim() === '')) return `请回答：${q.label}`;
    } else if (q.type === 'multi-tag') {
      if (!val || val.length === 0 || (q.minTags && val.length < q.minTags)) {
        return `请至少选择 ${q.minTags || 1} 项：${q.label}`;
      }
    }
    return null;
  };

  const handleNext = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');

    const validationError = validateCurrentQuestion();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (currentIndex < ALL_ITEMS.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setError('');
    }
  };

  const handleSubmit = async () => {
    const loginState = await auth.getLoginState();
    if (!loginState) return;
    setSaving(true);
    setError('');

    let embedding: number[] = [];
    try {
      const textToEmbed = `Bio: ${formData.bio || ''}. Answers: ${JSON.stringify(formData)}. AI Summary: ${formData.aiSummary || ''}`;
      embedding = await callAIEmbedding({
        model: 'embedding-3',
        input: textToEmbed
      });
    } catch (e) {
      console.error("Embedding generation failed:", e);
      // Continue saving even if embedding fails
    }

    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('User not found');
      
      const updateData = {
        name: formData.name,
        bio: formData.bio,
        avatarUrl: formData.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.name}`,
        displayProfile: formData.displayProfile || '',
        aiSummary: formData.aiSummary || '',
        questionnaire: formData,
        importantQuestions,
        embedding,
        onboardingCompleted: true,
        isParticipating: false,
        updatedAt: new Date().toISOString()
      };
      
      const res = await db.collection('users').doc(uid).get();
      if (res.data && res.data.length > 0) {
        await db.collection('users').doc(uid).update(updateData);
      } else {
        await db.collection('users').doc(uid).set({
          uid,
          ...updateData,
          createdAt: new Date().toISOString()
        });
      }
      navigate('/matches');
    } catch (err: any) {
      setError(err.message || '保存失败，请重试');
      setSaving(false);
    }
  };

  const renderQuestion = (q: any) => {
    if (q.isModuleIntro) {
      return (
        <div key={q.id} className="w-full bg-white rounded-3xl p-8 sm:p-12 shadow-sm border-2 border-gray-100 flex flex-col items-center justify-center text-center min-h-[350px]">
          {q.moduleIndex > 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-8 px-5 py-2 bg-green-50 text-green-600 rounded-full text-sm font-bold flex items-center gap-2 border border-green-100"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              上一模块已完成
            </motion.div>
          )}
          <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mb-6 border-2 border-gray-100 shadow-inner">
             <span className="text-3xl font-black text-gray-300">0{q.moduleIndex + 1}</span>
          </div>
          <h3 className="text-base font-bold text-gray-400 uppercase tracking-widest mb-3">
            {q.moduleIndex === 0 ? '第一部分' : '下一部分'}
          </h3>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-black mb-4 tracking-tight">{q.moduleTitle}</h2>
          <p className="text-lg text-gray-500 font-medium max-w-md mx-auto leading-relaxed">{q.moduleSubtitle}</p>
        </div>
      );
    }

    const val = formData[q.id];
    
    return (
      <div key={q.id} className="w-full bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 flex flex-col min-h-[200px]">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">
              {q.moduleTitle}
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-black leading-tight">{q.label}</h3>
            {q.hint && <p className="text-sm text-gray-500 font-medium mt-1">{q.hint}</p>}
          </div>
          {q.canMarkImportant && (
            <button 
              type="button"
              onClick={() => toggleImportant(q.id)}
              className={`flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold transition-colors shrink-0 ml-3 ${importantQuestions.includes(q.id) ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
            >
              <Star className={`w-4 h-4 ${importantQuestions.includes(q.id) ? 'fill-amber-500' : ''}`} />
              <span className="hidden sm:inline">设为重要</span>
            </button>
          )}
        </div>

        <div className="flex-1 flex flex-col justify-center min-h-[120px]">
          {q.type === 'input' && (
            <input
              type="text"
              value={val || ''}
              onChange={(e) => setFormData({ ...formData, [q.id]: e.target.value })}
              placeholder={q.hint || ''}
              className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black font-medium text-gray-900 text-base"
              autoFocus
            />
          )}

          {q.type === 'textarea' && (
            <textarea
              rows={3}
              value={val || ''}
              onChange={(e) => setFormData({ ...formData, [q.id]: e.target.value })}
              placeholder={q.hint || ''}
              className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black font-medium text-gray-900 resize-none text-base"
              autoFocus
            />
          )}

          {q.type === 'image-upload' && (
            <div className="flex flex-col items-center gap-4">
              {val ? (
                <img src={val} alt="Avatar" className="w-32 h-32 rounded-full object-cover border-4 border-gray-200" />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center border-4 border-gray-200 border-dashed">
                  <span className="text-gray-400 text-sm">暂无头像</span>
                </div>
              )}
              <label className="cursor-pointer px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors">
                选择图片
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    const loginState = await auth.getLoginState();
                    if (!file || !loginState) return;
                    try {
                      const uid = auth.currentUser?.uid;
                      const cloudPath = `avatars/${uid}_${Date.now()}_${file.name}`;
                      
                      const res = await appInstance.uploadFile({
                        cloudPath: cloudPath,
                        filePath: file
                      });
                      
                      const tempUrlRes = await appInstance.getTempFileURL({
                        fileList: [res.fileID]
                      });
                      
                      if (tempUrlRes.fileList && tempUrlRes.fileList.length > 0) {
                        setFormData({ ...formData, [q.id]: tempUrlRes.fileList[0].tempFileURL });
                      }
                    } catch (err) {
                      console.error("Upload failed", err);
                      alert("图片上传失败，请重试");
                    }
                  }}
                />
              </label>
            </div>
          )}

          {q.type === 'single' && (
            <div className={`grid gap-2 ${q.options.length === 3 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
              {q.options.map((opt: string) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, [q.id]: opt });
                    // Optional: auto-advance on single select
                    // setTimeout(() => handleNext(), 300);
                  }}
                  className={`px-5 py-4 rounded-xl border text-left font-bold text-base transition-all ${val === opt ? 'border-black bg-black text-white shadow-sm' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {q.type === 'select' && (
            <select
              value={val}
              onChange={(e) => setFormData({ ...formData, [q.id]: e.target.value })}
              className="w-full px-6 py-5 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-black font-bold text-gray-900 text-lg appearance-none"
            >
              <option value="">请选择...</option>
              {q.options.map((opt: string) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}

          {q.type === 'slider' && (
            <div className="pt-8 pb-4 px-2">
              <input
                type="range"
                min={q.min}
                max={q.max}
                value={val}
                onChange={(e) => setFormData({ ...formData, [q.id]: Number(e.target.value) })}
                className="w-full accent-black h-4 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-base text-gray-500 font-bold mt-6">
                <span className="w-1/3 text-left">{q.leftLabel || q.min}</span>
                <span className="w-1/3 text-center text-2xl text-black">{val}{q.unit || ''}</span>
                <span className="w-1/3 text-right">{q.rightLabel || q.max}</span>
              </div>
            </div>
          )}

          {q.type === 'double-slider' && (
            <div className="space-y-10 pt-4">
              <div>
                <div className="flex justify-between text-lg font-bold text-gray-700 mb-4">
                  <span>我自己</span>
                  <span className="text-xl text-black">{val.self}</span>
                </div>
                <input
                  type="range"
                  min={q.min}
                  max={q.max}
                  value={val.self}
                  onChange={(e) => setFormData({ ...formData, [q.id]: { ...val, self: Number(e.target.value) } })}
                  className="w-full accent-black h-4 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-lg font-bold text-gray-700 mb-4">
                  <span>{q.id.includes('partner') || q.id === 'decisionMaking' || q.id === 'socialEnergy' || q.id === 'smoking' || q.id === 'drinking' || q.id === 'appearanceType' ? '希望伴侣/能接受伴侣' : '希望伴侣'}</span>
                  <span className="text-xl text-black">{val.partner}</span>
                </div>
                <input
                  type="range"
                  min={q.min}
                  max={q.max}
                  value={val.partner}
                  onChange={(e) => setFormData({ ...formData, [q.id]: { ...val, partner: Number(e.target.value) } })}
                  className="w-full accent-black h-4 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div className="flex justify-between text-base text-gray-500 font-bold mt-2">
                <span className="w-1/2 text-left">{q.leftLabel}</span>
                <span className="w-1/2 text-right">{q.rightLabel}</span>
              </div>
            </div>
          )}

          {q.type === 'range-input' && (
            <div className="flex items-center justify-center gap-6 py-8">
              <input
                type="number"
                min={q.min}
                max={val.max}
                value={val.min}
                onChange={(e) => setFormData({ ...formData, [q.id]: { ...val, min: Number(e.target.value) } })}
                className="w-40 px-6 py-5 bg-gray-50 border-2 border-gray-200 rounded-xl text-center font-bold text-3xl focus:border-black focus:outline-none"
              />
              <span className="text-gray-400 font-bold text-3xl">—</span>
              <input
                type="number"
                min={val.min}
                max={q.max}
                value={val.max}
                onChange={(e) => setFormData({ ...formData, [q.id]: { ...val, max: Number(e.target.value) } })}
                className="w-40 px-6 py-5 bg-gray-50 border-2 border-gray-200 rounded-xl text-center font-bold text-3xl focus:border-black focus:outline-none"
              />
              <span className="text-gray-500 font-bold text-2xl">{q.unit}</span>
            </div>
          )}

          {q.type === 'multi-tag' && (
            <div>
              <div className="text-base text-gray-500 mb-6 font-bold bg-gray-50 inline-block px-6 py-3 rounded-full">
                已选 {val.length} / {q.maxTags} 项
              </div>
              {q.categories ? (
                <div className="space-y-8 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {q.categories.map((cat: any) => (
                    <div key={cat.category}>
                      <h4 className="text-base font-bold text-gray-400 uppercase tracking-widest mb-4">{cat.category}</h4>
                      <div className="flex flex-wrap gap-3">
                        {cat.tags.map((tag: string) => {
                          const isSelected = val.includes(tag);
                          const isDisabled = !isSelected && val.length >= q.maxTags;
                          return (
                            <button
                              key={tag}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => {
                                if (isSelected) {
                                  setFormData({ ...formData, [q.id]: val.filter((t: string) => t !== tag) });
                                } else if (val.length < q.maxTags) {
                                  setFormData({ ...formData, [q.id]: [...val, tag] });
                                }
                              }}
                              className={`px-4 py-3 rounded-full text-sm font-bold transition-all ${isSelected ? 'bg-black text-white shadow-md scale-105' : isDisabled ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {q.options.map((tag: string) => {
                    const isSelected = val.includes(tag);
                    const isDisabled = !isSelected && val.length >= q.maxTags;
                    return (
                      <button
                        key={tag}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (isSelected) {
                            setFormData({ ...formData, [q.id]: val.filter((t: string) => t !== tag) });
                          } else if (val.length < q.maxTags) {
                            setFormData({ ...formData, [q.id]: [...val, tag] });
                          }
                        }}
                        className={`px-4 py-3 rounded-full text-sm font-bold transition-all ${isSelected ? 'bg-black text-white shadow-md scale-105' : isDisabled ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {q.type === 'ai-chat' && (
            <div className="h-[500px] border-2 border-gray-200 rounded-2xl overflow-hidden">
              <AIChatOnboarding 
                onSummaryGenerated={(summary) => setFormData({ ...formData, aiSummary: summary })} 
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]"></div>;
  }

  const currentQ = ALL_ITEMS[currentIndex];
  const progress = Math.round(((currentIndex + 1) / ALL_ITEMS.length) * 100);

  return (
    <div className="min-h-screen bg-[#FAFAFA] py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center">
      
      {/* Progress Indicator */}
      <div className="w-full max-w-xl mb-8 relative">
        {hasExistingData && (
          <button 
            onClick={handleSubmit}
            disabled={saving}
            className="absolute -top-12 right-0 px-4 py-2 bg-black text-white rounded-full text-sm font-bold shadow-md hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {saving ? '保存中...' : '更改并提交'}
          </button>
        )}
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-bold text-gray-500">
            个性化档案
          </span>
          <span className="text-sm font-bold text-black">
            {currentIndex + 1} / {ALL_ITEMS.length}
          </span>
        </div>
        <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-black rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <div className="w-full max-w-xl relative">
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentIndex}
            initial={{ opacity: 0, x: 20, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.98 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full"
          >
            <form onSubmit={handleNext}>
              {renderQuestion(currentQ)}

              {error && (
                <div className="mt-6 text-red-600 text-sm font-bold bg-red-50 p-4 rounded-xl border border-red-100 text-center">
                  {error}
                </div>
              )}

              <div className="flex gap-4 mt-8">
                {currentIndex > 0 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="px-8 py-4 bg-white border-2 border-gray-200 hover:border-gray-300 text-black rounded-2xl font-bold text-lg transition-colors"
                  >
                    返回
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-4 px-8 bg-black hover:bg-gray-800 text-white rounded-2xl font-bold text-lg transition-colors disabled:opacity-50 shadow-lg flex items-center justify-center"
                >
                  {saving ? '处理中...' : (currentIndex === ALL_ITEMS.length - 1 ? (currentQ.type === 'ai-chat' && !formData.aiSummary ? '跳过并提交档案' : '提交档案') : (currentQ.isModuleIntro ? (currentQ.moduleIndex === 0 ? '开始填写' : '继续') : '下一个'))}
                </button>
              </div>
            </form>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
