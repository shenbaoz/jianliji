import type {
  AnalysisReport,
  FollowUpQuestion,
  OptimizedResume,
  ResumeInput
} from "../types";
import { sampleResumeCases } from "../data/sampleCases";
import { scoreWithResumlRubric } from "./resumlRubric";
import { buildEvidenceQuestions, buildMatchItems, classifyRole } from "./careerGuidance";


const normalizeLine = (line: string) =>
  line
    .replace(/[□■◆◇▪●•]/g, "")
    .replace(/^[\s\-—–·、.]+/, "")
    .replace(/^(?:[1-9]|[1-9]\d)[.、]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

const dedupeStrings = (items: string[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const sanitizeAnswer = (text: string) =>
  normalizeLine(text)
    .replace(/^我本人/, "")
    .replace(/^我主要/, "")
    .replace(/^我/, "")
    .replace(/^负责/, "")
    .replace(/[，,；;、\s]+$/, "")
    .trim();

const answerTextFor = (answers: Record<string, string>, keys: string[]) =>
  dedupeStrings(keys.map((key) => answers[key]?.trim()).filter(Boolean)).join("；");

const metricHintByProfile: Record<string, string> = {
  ads: "消耗、转化量、获客成本、ROI 或素材跑量数据",
  content: "曝光、播放、完播率、互动、涨粉、私信或成交数据",
  ops: "访问、点击、下单、核销、复购、GMV 或客单价数据",
  tech: "接口耗时、加载时间、错误率、用户量、迭代数或交付效率数据",
  product: "转化率、留存、使用率、投诉量、上线周期或付费数据",
  analysis: "数据量、报表数、模型指标、报告页数、采纳建议或业务改善结果",
  hr: "筛选量、邀约量、到面率、入职人数、留存率或流程效率数据",
  "finance-admin": "凭证量、报表周期、合同数量、回款金额、差错率或效率提升数据",
  retail: "销售额、客单价、连带率、复购率、库存周转或客诉下降数据",
  sales: "销售额、回款、转化率、续费率、客户数或满意度数据",
  creative: "作品数量、播放量、采用率、转化、交付周期或客户数量",
  engineering: "项目金额、设备数量、良率、交付周期、成本节约或安全质量数据",
  "education-medical": "服务人数、课程数量、续班率、满意度、投诉下降或护理量",
  generic: "人数、金额、频次、效率、增长率、转化率或交付成果"
};

const roleActionVerb = (profileId: string) => {
  const verbs: Record<string, string> = {
    ads: "优化",
    content: "策划并执行",
    ops: "策划并落地",
    tech: "开发并交付",
    product: "设计并推进",
    analysis: "分析并输出",
    hr: "推进",
    "finance-admin": "核对并处理",
    retail: "统筹",
    sales: "开发并维护",
    creative: "完成",
    engineering: "统筹并交付",
    "education-medical": "执行并跟进",
    generic: "推进"
  };
  return verbs[profileId] || verbs.generic;
};

const impactNounByProfile: Record<string, string> = {
  ads: "投放成本、转化质量和 ROI",
  content: "曝光、互动、涨粉和转化",
  ops: "访问、下单、核销和复购",
  tech: "页面体验、接口稳定性和交付效率",
  product: "用户体验、转化和需求交付质量",
  analysis: "业务判断、报表效率和决策支持",
  hr: "招聘效率、到面入职和流程体验",
  "finance-admin": "账务准确性、流程效率和风险控制",
  retail: "销售额、客单价、库存和服务体验",
  sales: "客户转化、回款续费和满意度",
  creative: "作品质量、交付效率和传播效果",
  engineering: "进度、质量、成本和安全",
  "education-medical": "服务质量、满意度和风险处理",
  generic: "交付质量、协作效率和业务结果"
};

const outputAssetByProfile: Record<string, string> = {
  ads: "沉淀账户日报、素材测试记录和成本异常复盘",
  content: "沉淀选题表、脚本模板、发布排期和数据复盘记录",
  ops: "沉淀活动检查表、社群话术、页面 FAQ 和复盘记录",
  tech: "沉淀组件说明、接口联调记录、异常处理方案和自测清单",
  product: "沉淀需求文档、流程图、原型说明和上线验收记录",
  analysis: "沉淀数据口径、分析表、可视化图表和结论说明",
  hr: "沉淀候选人台账、邀约话术、面试反馈和入职跟进记录",
  "finance-admin": "沉淀台账、核对记录、流程说明和风险提示",
  retail: "沉淀排班表、带教记录、陈列检查和会员维护台账",
  sales: "沉淀客户跟进表、沟通话术、报价记录和复盘要点",
  creative: "沉淀素材规范、版本记录、交付清单和作品复盘",
  engineering: "沉淀进度表、验收记录、问题闭环表和风险清单",
  "education-medical": "沉淀服务记录、沟通反馈、异常处理和质量复盘",
  generic: "沉淀执行记录、协作清单、问题复盘和后续优化建议"
};

function roleProfile(role: string, jd: string) {
  const combined = `${role} ${jd}`;
  if (/信息流|投放|巨量|引擎|优化师|广告|账户|计划|出价|素材|ROI|消耗|投产|ocpc|千川/.test(combined)) {
    return {
      focus: "信息流广告投放",
      capability:
        "熟悉信息流账户搭建、计划创建、预算分配、出价调控、素材测试、成本监控和数据复盘",
      scenario:
        "可围绕消耗、点击、转化、获客成本、ROI、素材通过率和投放稳定性优化账户效果",
      skills: ["信息流投放", "巨量引擎", "账户搭建", "计划优化", "素材测试", "成本控制", "数据复盘", "ROI"],
      projects: [
        "信息流账户结构搭建、计划创建、预算分配和出价调控",
        "素材上新、跑量监控、成本异常处理和日报复盘",
        "围绕点击率、转化成本、消耗和 ROI 做投放策略迭代"
      ]
    };
  }
  if (/小红书|抖音|短视频|直播|千川|达人|种草|新媒体|视频号|快手|B站|知乎/.test(combined)) {
    return {
      focus: "内容/新媒体运营",
      capability:
        "熟悉主流内容平台的账号定位、选题策划、脚本/笔记生产、发布排期、互动维护和数据复盘",
      scenario:
        "可围绕曝光、播放、完播、互动、涨粉、私信、留资、成交、GMV 和 ROI 等指标优化内容与转化链路",
      skills: ["小红书运营", "抖音运营", "短视频脚本", "内容选题", "达人合作", "直播运营", "数据复盘", "剪映"],
      projects: [
        "小红书图文/视频笔记选题、标题封面、评论私信维护和种草转化",
        "抖音短视频脚本、拍摄剪辑、直播预热、团购/商品转化和账号增长",
        "达人合作、投放素材测试、热点追踪、平台数据复盘和内容策略迭代"
      ]
    };
  }
  if (/小程序|私域|商城|会员|社群/.test(combined)) {
    return {
      focus: "小程序运营",
      capability:
        "熟悉微信小程序/商城日常运营、活动策划、商品与页面维护、私域社群触达和数据复盘",
      scenario:
        "可围绕访问、点击、下单、券核销、复购和会员活跃等指标推进运营动作",
      skills: ["微信小程序后台", "商品运营", "活动策划", "社群运营", "用户分层", "优惠券策略", "Excel 数据分析"],
      projects: [
        "小程序首页资源位、活动页、优惠券、商品详情页配置与检查",
        "节日大促/会员日/新品上架活动策划、上线跟进与复盘",
        "企业微信社群触达、用户标签维护、沉默用户召回与复购提升"
      ]
    };
  }
  if (/前端|React|TypeScript|JavaScript|开发|工程师/.test(combined)) {
    return {
      focus: "前端开发",
      capability:
        "具备页面开发、组件封装、接口联调、异常状态处理和前端性能优化基础",
      scenario:
        "能与产品、设计、后端协作完成需求评审、开发、自测、联调和上线迭代",
      skills: ["TypeScript", "JavaScript", "React", "微信小程序", "接口联调", "Git", "性能优化"],
      projects: [
        "业务页面开发、表单校验、列表分页、登录态和异常提示处理",
        "公共组件封装与复用，减少重复开发成本",
        "图片压缩、分包加载、接口拆分、骨架屏等性能优化"
      ]
    };
  }
  if (/产品|需求|用户体验|原型|竞品/.test(combined)) {
    return {
      focus: "产品",
      capability: "具备需求调研、竞品分析、原型设计、需求文档和跨团队推进能力",
      scenario: "能从用户反馈、业务目标和数据现象中拆解需求优先级",
      skills: ["需求分析", "竞品分析", "原型设计", "用户调研", "PRD", "Figma", "Axure"],
      projects: ["用户访谈与需求整理", "竞品拆解和功能优先级判断", "原型、流程图、需求文档输出"]
    };
  }
  return {
    focus: "目标岗位",
    capability: "具备岗位相关项目执行、沟通协作、问题拆解和结果复盘能力",
    scenario: "能结合岗位目标完成任务拆解、推进落地和复盘优化",
    skills: ["项目执行", "沟通协作", "数据复盘", "问题拆解", "Office", "业务理解"],
    projects: ["核心任务拆解与推进", "跨团队沟通协作", "结果复盘与改进建议"]
  };
}

type QuestionProfile = {
  id: string;
  metricQuestion: string;
  roleQuestion: string;
  difficultyQuestion: string;
  metricReason: string;
  roleReason: string;
  difficultyReason: string;
  specificQuestions: FollowUpQuestion[];
};

const genericQuestionProfile: QuestionProfile = {
  id: "generic",
  metricQuestion: "你最想重点展示的一段经历，有没有人数、金额、增长率、阅读量、转化率或效率提升数据？",
  roleQuestion: "这段经历里，哪些事情是你本人独立完成或主要负责的？",
  difficultyQuestion: "这个项目当时最难的地方是什么，你用了什么方法解决？",
  metricReason: "把普通职责变成更可信的结果表达。",
  roleReason: "避免简历只写团队成果，看不出你的个人贡献。",
  difficultyReason: "补充解决问题能力，让经历更像面试可追问的材料。",
  specificQuestions: []
};

function questionProfileFor(roleAndRequirement: string): QuestionProfile {
  const primaryRole = roleAndRequirement.split(/\s+/)[0] || roleAndRequirement;

  if (/信息流|投放|巨量|引擎|优化师|广告|账户|计划|出价|素材|ROI|消耗|投产|ocpc|千川/.test(roleAndRequirement)) {
    return {
      id: "ads",
      metricQuestion: "你最想重点展示的一段投放经历，有没有月消耗、单日消耗、转化量、获客成本、点击率、ROI 或素材跑量数据？",
      roleQuestion: "这段投放经历里，哪些账户和动作是你本人独立负责的？例如账户结构、计划创建、预算、出价、素材、日报复盘。",
      difficultyQuestion: "投放过程中最难的问题是什么？例如起量慢、成本升高、素材衰退、账户不稳定或转化质量差，你怎么处理？",
      metricReason: "投放岗最需要用消耗、成本和转化指标证明实操结果。",
      roleReason: "投放岗需要看你是否真的接触过账户操作和效果优化。",
      difficultyReason: "补充账户优化判断，而不是只写执行投放。",
      specificQuestions: [
        {
          id: "ads-account",
          question: "你投放时主要负责哪些环节？例如账户搭建、计划创建、预算分配、出价调整、素材上新、数据日报或成本复盘。",
          reason: "确认投放实操深度。"
        },
        {
          id: "ads-result",
          question: "有没有消耗、转化、获客成本、点击率、ROI、素材通过率或线索量这类数据？可以写大概区间。",
          reason: "用投放指标证明结果，比单写「负责投放」更可信。"
        }
      ]
    };
  }

  if (
    /小红书|抖音|短视频|直播|达人|种草|新媒体|公众号|视频号|快手|B站|知乎|内容运营/.test(roleAndRequirement) &&
    !/UI|视觉|平面|设计师|剪辑|摄影|后期|编辑|文案|编导|传媒|包装/.test(primaryRole)
  ) {
    return {
      id: "content",
      metricQuestion: "你最想展示的内容/账号经历，有没有曝光、播放、完播、互动、涨粉、私信、留资或成交数据？",
      roleQuestion: "这段经历里，你本人负责的是选题、脚本、拍摄剪辑、发布、互动维护、达人合作，还是数据复盘？",
      difficultyQuestion: "内容效果不稳定时，你怎么判断问题出在选题、封面标题、前 3 秒、发布时间、互动还是转化链路？",
      metricReason: "内容运营要用平台指标证明内容和转化效果。",
      roleReason: "拆清你在内容链路里的真实贡献。",
      difficultyReason: "体现内容判断和复盘能力。",
      specificQuestions: [
        {
          id: "content-process",
          question: "你有没有完整做过一条内容从选题到发布复盘的流程？每周/每月大概产出多少条？",
          reason: "内容岗会看稳定产出和流程掌控。"
        },
        {
          id: "content-conversion",
          question: "这些内容最后导向什么目标？例如涨粉、私信、留资、进群、到店、成交或品牌曝光。",
          reason: "把内容动作和业务目标接起来。"
        }
      ]
    };
  }

  if (
    /小程序|私域|商城|会员|社群|用户运营|活动运营|电商运营|店铺运营/.test(roleAndRequirement) &&
    !/店长|门店|导购|零售|餐饮|酒店|前台|收银|陈列|库存|区域督导/.test(primaryRole)
  ) {
    return {
      id: "ops",
      metricQuestion: "你最想展示的一次运营动作，有没有访问、点击、下单、核销、复购、GMV、客单价或留存数据？",
      roleQuestion: "这次运营里，你本人负责活动策划、页面配置、商品维护、优惠券、社群触达、用户分层还是数据复盘？",
      difficultyQuestion: "当访问、转化或复购不理想时，你怎么定位问题并调整运营动作？",
      metricReason: "运营岗需要用业务指标证明动作有效。",
      roleReason: "说明你负责的运营链路，不只写「协助运营」。",
      difficultyReason: "体现数据意识和迭代能力。",
      specificQuestions: [
        {
          id: "ops-campaign",
          question: "有没有你独立推进过的活动？请补充活动周期、目标人群、资源位、优惠机制和最终结果。",
          reason: "活动运营需要展示从策划到落地的完整闭环。"
        },
        {
          id: "ops-user",
          question: "你有没有做过用户分层、社群维护、优惠券触达或沉默用户召回？效果如何？",
          reason: "用户运营要看分层和触达结果。"
        }
      ]
    };
  }

  if (
    /前端|后端|Java|React|TypeScript|测试开发|软件开发|开发工程师|算法|运维|数据库|工程师/.test(roleAndRequirement) &&
    !/工程项目|施工|土建|机电|电气|自动化|生产|质检|质量|采购|供应链|仓储|物流|设备|制造|工艺/.test(primaryRole)
  ) {
    return {
      id: "tech",
      metricQuestion: "你最想展示的技术项目，有没有性能、稳定性、接口耗时、错误率、并发量、用户量或交付效率数据？",
      roleQuestion: "这个项目里，你本人负责哪些模块？例如页面、接口、数据库、权限、测试、部署、性能优化或问题排查。",
      difficultyQuestion: "这个技术项目里最具体的技术难点是什么？例如性能、接口、状态管理、数据库、并发、兼容性或测试问题。",
      metricReason: "技术岗也需要用可验证结果证明工程价值。",
      roleReason: "技术简历要拆清模块边界和个人贡献。",
      difficultyReason: "技术岗需要看到工程难度，而不只是技术栈列表。",
      specificQuestions: [
        {
          id: "tech-stack",
          question: "项目里用到的核心技术栈是什么？你实际写了哪些代码或配置？",
          reason: "避免只罗列技术名词，要说明真实使用场景。"
        },
        {
          id: "tech-quality",
          question: "你有没有做过自测、联调、错误处理、日志排查、性能优化或上线后问题修复？",
          reason: "工程岗会关注交付质量和线上意识。"
        }
      ]
    };
  }

  if (/产品|需求|用户体验|原型|竞品|PRD|功能设计|产品经理/.test(roleAndRequirement)) {
    return {
      id: "product",
      metricQuestion: "你做过的产品/需求项目，有没有转化率、使用率、留存、投诉量、效率、付费或活跃数据？",
      roleQuestion: "这个需求里，你本人负责用户调研、竞品分析、流程图、原型、PRD、评审推进、验收还是上线复盘？",
      difficultyQuestion: "你当时怎么判断需求优先级？依据来自用户反馈、数据、竞品、业务目标，还是团队讨论？",
      metricReason: "产品岗需要用指标说明需求价值。",
      roleReason: "产品经历要体现从判断到推进的责任范围。",
      difficultyReason: "产品岗会看判断依据和取舍能力。",
      specificQuestions: [
        {
          id: "product-tradeoff",
          question: "有没有一个你做过取舍的需求？为什么先做它、不做另一个？",
          reason: "补充产品判断和优先级能力。"
        },
        {
          id: "product-delivery",
          question: "需求上线后，你怎么验收和复盘？有没有用户反馈或数据变化？",
          reason: "体现闭环，而不是只写产出文档。"
        }
      ]
    };
  }

  if (/数据分析|商业分析|经营分析|金融|投研|咨询|财务分析|行业研究|SQL|BI/.test(roleAndRequirement)) {
    return {
      id: "analysis",
      metricQuestion: "你最想展示的分析项目，有没有数据量、报表数量、模型指标、报告页数、采纳建议或业务改善结果？",
      roleQuestion: "这个分析里，你本人负责数据提取、清洗、建模、可视化、结论撰写、汇报还是业务沟通？",
      difficultyQuestion: "分析过程中最难的是数据口径、数据质量、业务拆解、模型假设，还是结论落地？你怎么处理？",
      metricReason: "分析类岗位需要展示数据规模和结论价值。",
      roleReason: "说明你不是只整理资料，而是参与分析闭环。",
      difficultyReason: "体现分析判断和解决问题能力。",
      specificQuestions: [
        {
          id: "analysis-output",
          question: "你最终产出了什么分析结果？例如报告、图表、看板、结论、建议，或被团队采用的判断。",
          reason: "分析类岗位需要展示信息整理后的结论产出。"
        },
        {
          id: "analysis-tools",
          question: "你实际使用过哪些工具？例如 Excel、SQL、Python、Tableau、Power BI、Wind、Choice，分别用来做什么？",
          reason: "工具要和真实任务绑定。"
        }
      ]
    };
  }

  if (/招聘|人事|HR|HRBP|行政|人力/.test(roleAndRequirement)) {
    return {
      id: "hr",
      metricQuestion: "你最想展示的一段 HR/行政经历，有没有招聘人数、邀约量、到面率、入职率、留存率、处理事项量或效率提升数据？",
      roleQuestion: "这段经历里，你本人负责招聘渠道、简历筛选、电话邀约、面试安排、员工手续、台账还是跨部门沟通？",
      difficultyQuestion: "当候选人不到面、岗位难招、流程卡住或员工反馈集中时，你怎么处理？",
      metricReason: "HR/行政岗位需要用流程效率和结果证明执行力。",
      roleReason: "说明你负责的流程节点和独立程度。",
      difficultyReason: "体现沟通协调和问题处理能力。",
      specificQuestions: [
        {
          id: "hr-channel",
          question: "你维护过哪些渠道或流程？每月大概处理多少候选人、面试、入职或行政事项？",
          reason: "补充工作量和熟练度。"
        }
      ]
    };
  }

  if (/会计|出纳|财务|税务|审计|应收|应付|成本会计|法务|合同|合规/.test(roleAndRequirement)) {
    return {
      id: "finance-admin",
      metricQuestion: "你最想展示的一段财务/法务/行政经历，有没有凭证数量、报表周期、合同数量、回款金额、差错率或效率提升数据？",
      roleQuestion: "这段经历里，你本人负责凭证、报销、开票、税务、应收应付、报表、合同审核、档案台账还是跨部门沟通？",
      difficultyQuestion: "遇到账实不符、资料缺失、发票问题、合同风险或流程卡点时，你怎么核对和推进？",
      metricReason: "职能岗要用准确性、工作量和流程结果证明可靠度。",
      roleReason: "说明你负责的具体流程，不只写「日常财务/行政工作」。",
      difficultyReason: "体现细致度、风险意识和闭环能力。",
      specificQuestions: [
        {
          id: "finance-admin-tools",
          question: "你用过哪些系统或工具？例如金蝶、用友、Excel、OA、合同系统，分别处理什么工作？",
          reason: "把工具和真实业务场景绑定。"
        }
      ]
    };
  }

  if (/店长|门店|导购|零售|餐饮|酒店|前台|收银|陈列|库存|区域督导/.test(roleAndRequirement)) {
    return {
      id: "retail",
      metricQuestion: "你最想展示的一段门店/服务经历，有没有销售额、客单价、连带率、复购率、库存周转、客诉下降或团队人数数据？",
      roleQuestion: "这段经历里，你本人负责销售接待、排班带教、陈列、库存、盘点、会员维护、活动执行还是客诉处理？",
      difficultyQuestion: "遇到销售下滑、库存积压、人员不稳定、顾客投诉或活动转化差时，你怎么处理？",
      metricReason: "门店服务岗需要用经营指标和服务结果证明能力。",
      roleReason: "拆清你的管理、销售和服务责任范围。",
      difficultyReason: "体现现场问题处理和经营意识。",
      specificQuestions: [
        {
          id: "retail-team",
          question: "你有没有带教新人、管理排班或做销售话术复盘？团队规模和变化效果如何？",
          reason: "门店管理岗会看团队管理和带教能力。"
        }
      ]
    };
  }

  if (/销售|客服|客户成功|商务|BD|续费|回款|客诉/.test(roleAndRequirement)) {
    return {
      id: "sales",
      metricQuestion: "你最想展示的一段销售/客服经历，有没有销售额、回款、转化率、续费率、客诉下降、服务客户数或满意度数据？",
      roleQuestion: "这段经历里，你本人负责线索开发、客户沟通、方案报价、成交跟进、续费、售后还是客诉处理？",
      difficultyQuestion: "遇到客户拒绝、价格异议、竞品比较、投诉或续费困难时，你怎么推进？",
      metricReason: "销售/客服岗需要用结果和客户规模证明能力。",
      roleReason: "拆清你负责的是前端转化、过程推进还是后端维护。",
      difficultyReason: "体现沟通说服和问题解决能力。",
      specificQuestions: [
        {
          id: "sales-method",
          question: "你有没有沉淀过话术、客户分层、跟进表或复盘方法？带来了什么变化？",
          reason: "让经历从执行升级到方法论。"
        }
      ]
    };
  }

  if (/UI|视觉|平面|设计师|剪辑|视频|摄影|后期|编辑|文案|编导|传媒|包装/.test(roleAndRequirement)) {
    return {
      id: "creative",
      metricQuestion: "你最想展示的一段设计/剪辑/内容制作经历，有没有作品数量、播放量、转化、交付周期、客户数量或采用率数据？",
      roleQuestion: "这段经历里，你本人负责需求沟通、创意、脚本、拍摄、剪辑、包装、调色、排版、改稿还是交付验收？",
      difficultyQuestion: "遇到需求不清、反复改稿、素材不足、风格不统一或交付时间紧时，你怎么处理？",
      metricReason: "创意岗位也需要用产出规模和效果证明价值。",
      roleReason: "说明你在作品链路里的真实贡献。",
      difficultyReason: "体现审美执行、沟通和交付能力。",
      specificQuestions: [
        {
          id: "creative-portfolio",
          question: "有没有代表作品或作品集？请补充作品类型、你的职责、使用工具和最终效果。",
          reason: "设计/传媒岗强依赖作品证明。"
        }
      ]
    };
  }

  if (/工程项目|施工|土建|机电|电气|自动化|生产|质检|质量|采购|供应链|仓储|物流|设备|制造|工艺/.test(roleAndRequirement)) {
    return {
      id: "engineering",
      metricQuestion: "你最想展示的一段工程/制造/供应链经历，有没有项目金额、面积、设备数量、良率、交付周期、成本节约或安全质量数据？",
      roleQuestion: "这段经历里，你本人负责计划、现场协调、质量检查、设备调试、采购跟进、供应商、仓储发货还是异常处理？",
      difficultyQuestion: "遇到延期、质量异常、设备故障、供应商延迟、成本超支或安全风险时，你怎么处理？",
      metricReason: "工程制造类岗位需要用规模、质量、成本和交付结果证明能力。",
      roleReason: "说明你负责的现场/流程节点和协作对象。",
      difficultyReason: "体现现场问题处理和风险控制能力。",
      specificQuestions: [
        {
          id: "engineering-standards",
          question: "你是否参与过验收、巡检、SOP、BOM、图纸、设备参数或质量标准相关工作？具体负责什么？",
          reason: "补充专业流程和标准意识。"
        }
      ]
    };
  }

  if (/教师|教务|课程顾问|培训|护士|护理|医生|医助|康复|客服医疗|教育/.test(roleAndRequirement)) {
    return {
      id: "education-medical",
      metricQuestion: "你最想展示的一段教育/医疗服务经历，有没有服务人数、课程数量、续班率、满意度、投诉下降、护理量或效率数据？",
      roleQuestion: "这段经历里，你本人负责授课、备课、家校沟通、教务排课、患者沟通、护理执行、记录整理还是异常反馈？",
      difficultyQuestion: "遇到学生/家长沟通困难、学习效果不佳、患者反馈、突发情况或流程压力时，你怎么处理？",
      metricReason: "教育医疗服务岗需要用服务规模、质量和反馈证明可靠度。",
      roleReason: "说明你在服务链路里的责任和专业边界。",
      difficultyReason: "体现沟通、耐心和风险处理能力。",
      specificQuestions: [
        {
          id: "education-medical-quality",
          question: "有没有被家长、学员、患者、主管或团队认可的案例？请补充场景和结果。",
          reason: "服务岗位很看重真实反馈和口碑。"
        }
      ]
    };
  }

  return genericQuestionProfile;
}

function skillLabelsFor(roleAndRequirement: string) {
  const profile = questionProfileFor(roleAndRequirement);
  const labelsByProfile: Record<string, string[]> = {
    ads: ["信息流", "投放", "账户", "计划", "素材", "ROI"],
    content: ["内容", "选题", "短视频", "互动", "涨粉", "转化"],
    ops: ["运营", "活动", "用户", "社群", "转化", "复盘"],
    tech: ["开发", "接口", "性能", "测试", "协作", "上线"],
    product: ["产品", "需求", "原型", "竞品", "推进", "复盘"],
    analysis: ["数据", "分析", "报表", "结论", "工具", "汇报"],
    hr: ["招聘", "邀约", "面试", "台账", "沟通", "流程"],
    "finance-admin": ["财务", "凭证", "报表", "合同", "核对", "流程"],
    retail: ["销售", "门店", "会员", "库存", "服务", "团队"],
    sales: ["销售", "客户", "转化", "续费", "客诉", "回款"],
    creative: ["作品", "剪辑", "设计", "交付", "改稿", "工具"],
    engineering: ["工程", "质量", "设备", "交付", "成本", "安全"],
    "education-medical": ["服务", "沟通", "记录", "反馈", "质量", "耐心"],
    generic: ["岗位证据", "个人贡献", "量化结果", "沟通协作", "问题处理", "复盘"]
  };
  return labelsByProfile[profile.id] || labelsByProfile.generic;
}

function dedupeQuestions(questions: FollowUpQuestion[]) {
  const seen = new Set<string>();
  return questions.filter((item) => {
    const key = `${item.id}-${item.question}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const keywordBank = [
  "报表制作", "数据可视化", "专题分析", "数据整理", "业务分析", "分析结论", "沟通协作", "问题发现", "用户调研", "项目推进", "活动执行", "内容创作",
  "React",
  "TypeScript",
  "JavaScript",
  "数据",
  "增长",
  "运营",
  "用户",
  "项目",
  "沟通",
  "协作",
  "复盘",
  "转化",
  "留存",
  "产品",
  "需求",
  "设计",
  "后端",
  "前端",
  "Python",
  "SQL",
  "AIGC",
  "AI",
  "内容",
  "社群",
  "活动",
  "销售",
  "客户",
  "信息流",
  "投放",
  "巨量引擎",
  "广告",
  "账户",
  "计划",
  "出价",
  "素材",
  "消耗",
  "获客成本",
  "ROI"
];

const hasMetric = (text: string) => /(\d+|%|万|千|百|提升|降低|增长|减少|超过|累计)/.test(text);

const pickLines = (text: string, pattern: RegExp, limit = 4) =>
  text
    .split(/\n+/)
    .map((line) => normalizeLine(line))
    .filter((line) => pattern.test(line))
    .slice(0, limit);

const isResumeMetaLine = (line: string) =>
  /求职目标|联系方式|邮箱|电话/.test(line) ||
  /^(工作经历|项目经历|教育经历|技能|技能清单|个人优势)$/.test(line) ||
  (/经验/.test(line) && /[｜|]/.test(line) && line.length < 42);

const isIdentityLine = (line: string) =>
  /姓名|性别|出生年月|政治面貌|籍贯|民族|邮箱|电话|联系方式/.test(line) ||
  /^[\u4e00-\u9fa5A-Za-z·]{2,12}$/.test(line) ||
  /^[\u4e00-\u9fa5A-Za-z·]{2,12}\s*[｜|]/.test(line);

const knownCityPattern = /北京|上海|广州|深圳|杭州|成都|武汉|南京|苏州|厦门|重庆|郑州|三亚|泉州|天津|西安|长沙|合肥|宁波|青岛|大连|佛山|东莞|无锡|常州|福州|昆明|南昌|沈阳|济南|哈尔滨|长春|南宁|贵阳|太原|石家庄|成都/;

function extractResumeHeader(input: ResumeInput) {
  const lines = (input.resumeText || "")
    .split(/\n+/)
    .map((line) => normalizeLine(line))
    .filter(Boolean);
  const firstInfoLine = lines.find((line) => /[｜|]/.test(line)) || lines[0] || "";
  const parts = firstInfoLine.split(/｜|\|/).map((item) => item.trim()).filter(Boolean);
  const phoneMatch = input.resumeText.match(/(?:\+?86[-\s]?)?1[3-9]\d{9}/);
  const emailMatch = input.resumeText.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  const targetLine = lines.find((line) => /^求职(?:目标|意向)[:：]/.test(line));
  const name =
    compactCandidateName(input.candidateName) ||
    parts.map(compactCandidateName).find(Boolean) ||
    lines.slice(0, 8).map(compactCandidateName).find(Boolean) ||
    "求职者";
  const age = parts.find((part) => /\d+\s*岁/.test(part));
  const city = parts.find((part) => knownCityPattern.test(part));
  const contactItems = [
    phoneMatch?.[0],
    emailMatch?.[0],
    age
  ].filter(Boolean);

  return {
    name,
    target: targetLine?.replace(/^求职(?:目标|意向)[:：]\s*/, "") || input.targetRole || parts.slice(1).join(" / ") || "目标岗位",
    contactLine: contactItems.length ? `联系方式：${contactItems.join(" ｜ ")}` : ""
  };
}

function compactCandidateName(value: string) {
  const compact = String(value || "").replace(/\s+/g, "");
  if (!/^[\u4e00-\u9fa5·]{2,4}$/.test(compact)) return "";
  if (/^(简历|求职者|个人信息|联系方式|工作经历|实习经历|项目经历|教育经历|技能|证书|荣誉)$/.test(compact)) return "";
  return compact;
}

const getSectionLines = (text: string, headings: string[]) => {
  const lines = text.split(/\n+/).map((line) => normalizeLine(line)).filter(Boolean);
  const headingPattern = /^(个人优势|工作经历|实习经历|项目经历|教育经历|技能|技能清单|自我评价|校园经历|证书|荣誉)/;
  const startIndex = lines.findIndex((line) => headings.some((heading) => line.startsWith(heading)));
  if (startIndex < 0) return [];
  const result: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (headingPattern.test(lines[index])) break;
    if (!isResumeMetaLine(lines[index])) result.push(lines[index]);
  }
  return result;
};

const getCoreExperienceLines = (text: string, limit = 5) => {
  const sectionLines = [
    ...getSectionLines(text, ["工作经历", "实习经历"]),
    ...getSectionLines(text, ["项目经历"])
  ];
  const source = sectionLines.length ? sectionLines : text.split(/\n+/).map((line) => normalizeLine(line));
  return source
    .filter((line) => line && !isResumeMetaLine(line))
    .filter((line) => /负责|维护|策划|运营|投放|优化|账户|素材|预算|数据|复盘|转化|成交|沟通|协作|分析|上线|管理|推动|完成/.test(line))
    .slice(0, limit);
};

const pickExperienceLines = (text: string, limit = 5) =>
  getCoreExperienceLines(text, limit);

const sectionHeadingPattern = /^(个人优势|工作经历|实习经历|项目经历|校园项目|校园实践|教育经历|技能|技能清单|自我评价|校园经历|证书|荣誉)/;

const getRelevantLines = (text: string, limit = 6) =>
  text
    .split(/\n+/)
    .map((line) => normalizeLine(line))
    .filter(Boolean)
    .filter((line) => !isResumeMetaLine(line) && !sectionHeadingPattern.test(line))
    .filter((line) => /负责|参与|协助|主导|独立|完成|搭建|优化|维护|整理|输出|推动|提升|降低|增长|累计|管理|对接|跟进|分析|策划|开发|设计|处理/.test(line))
    .slice(0, limit);

const toBullet = (line: string) => {
  const cleaned = normalizeLine(line)
    .replace(/^[-–—]\s*/, "")
    .replace(/^[一二三四五六七八九十]+[、.]\s*/, "");
  if (!cleaned) return "";
  if (/负责|参与|协助|主导|独立|完成|搭建|优化|维护|整理|输出|推动|提升|降低|增长|累计|管理|对接|跟进|分析|策划|开发|设计|处理/.test(cleaned)) {
    return `- ${cleaned}`;
  }
  return `- ${cleaned}`;
};

const findSkillLine = (text: string) =>
  text
    .split(/\n+/)
    .map((line) => normalizeLine(line))
    .find((line) => /^(?:专业)?技能(?:清单)?/.test(line));

const getEducationLines = (text: string) =>
  getSectionLines(text, ["教育经历"]).slice(0, 3);

const getResumeSummary = (role: string, profile: ReturnType<typeof roleProfile>, keywords: string[]) => {
  const visibleKeywords = keywords.slice(0, 4).join("、");
  const keywordClause = visibleKeywords ? `具备${visibleKeywords}相关经验` : profile.capability;
  const scenario = profile.scenario.replace(/^可/, "");
  return `面向${role}，${keywordClause}；熟悉${profile.focus}相关流程，能够${scenario}，具备把执行动作转化为业务结果的意识。`;
};

const tokenizeForCaseMatch = (text: string) =>
  Array.from(new Set(
    text
      .toLowerCase()
      .match(/[a-z0-9+#.]+|[\u4e00-\u9fa5]{2,}/g) || []
  ));

const getRelevantSampleCases = (role: string, jd: string, resume: string) => {
  const queryTokens = tokenizeForCaseMatch(`${role} ${jd} ${resume}`);
  const queryTokenSet = new Set(queryTokens);

  return sampleResumeCases
    .map((item) => {
      const caseText = `${item.title} ${item.userType} ${item.targetRole} ${item.summary} ${item.jobDescription} ${item.resumeText}`;
      const caseTokens = tokenizeForCaseMatch(caseText);
      const overlapScore = caseTokens.reduce((score, token) => score + (queryTokenSet.has(token) ? 1 : 0), 0);
      const roleScore = item.targetRole.includes(role) || role.includes(item.targetRole) ? 18 : 0;
      const platformScore = keywordBank.reduce((score, keyword) => (
        caseText.includes(keyword) && `${role} ${jd}`.includes(keyword) ? score + 2 : score
      ), 0);
      return { item, score: overlapScore + roleScore + platformScore };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ item }) => item);
};

const extractSkillsFromCases = (cases: typeof sampleResumeCases) =>
  dedupeStrings(
    cases.flatMap((item) => {
      const skillLine = findSkillLine(item.resumeText);
      return skillLine
        ? skillLine.replace(/^(?:专业)?技能(?:清单)?[:：]?\s*/, "").split(/、|，|,|\s+/).map((skill) => skill.trim())
        : [];
    })
  );

const extractExperienceLinesFromCases = (cases: typeof sampleResumeCases, headings: string[]) =>
  dedupeStrings(
    cases.flatMap((item) =>
      getSectionBody(item.resumeText, headings)
        .filter((line) => actionLinePattern.test(line))
        .map((line) => normalizeLine(line))
    )
  );

const formatSection = (title: string, lines: string[]) => {
  const content = lines.filter(Boolean);
  return content.length ? [title, ...content, ""].join("\n") : "";
};

const getSectionBody = (text: string, headings: string[]) => {
  const lines = text.split(/\n+/).map((line) => normalizeLine(line)).filter(Boolean);
  const startIndex = lines.findIndex((line) => headings.some((heading) => line.startsWith(heading)));
  if (startIndex < 0) return [];
  const result: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (sectionHeadingPattern.test(lines[index])) break;
    if (!isResumeMetaLine(lines[index])) result.push(lines[index]);
  }
  return result;
};

const isEntryTitle = (line: string) =>
  /[｜|]/.test(line) ||
  /^「.+」/.test(line) ||
  /^(20|19)\d{2}|20XX|至今/.test(line) ||
  /^(项目|活动|专项|作品|案例)\s*[:：]/.test(line);

const actionLinePattern = /负责|参与|协助|主导|独立|完成|搭建|优化|维护|整理|输出|推动|提升|降低|增长|累计|管理|对接|跟进|分析|策划|开发|设计|处理|使用|通过|根据|配合|建立|协同/;

const linePrefixPattern = /^(\s*(?:[-–—·]|\d+[.、]|[一二三四五六七八九十]+[、.])\s*)?/;

const polishExperienceContent = (
  content: string,
  role: string,
  profile: ReturnType<typeof roleProfile>,
  learnedSkills: string[],
  answers: Record<string, string> = {},
  profileId = "generic",
  index = 0,
  learnedExperiencePatterns: string[] = []
) => {
  let polished = normalizeLine(content)
    .replace(/^主要负责/, "负责")
    .replace(/^协助做/, "协助完成")
    .replace(/^参与做/, "参与完成")
    .replace(/^做/, "负责")
    .replace(/进行数据统计/g, "完成数据统计与复盘")
    .replace(/日常运营/g, "日常运营执行")
    .replace(/沟通/g, "沟通协调")
    .replace(/整理资料/g, "整理资料并形成可复用台账");

  if (!polished || isEntryTitle(polished) || sectionHeadingPattern.test(polished) || isResumeMetaLine(polished)) {
    return polished;
  }

  if (!actionLinePattern.test(polished) && polished.length >= 12) {
    polished = `负责${polished}`;
  }

  if (!/。$/.test(polished)) polished = `${polished}。`;
  return polished;
};

const polishLineKeepingFormat = (
  rawLine: string,
  currentSection: string,
  role: string,
  profile: ReturnType<typeof roleProfile>,
  learnedSkills: string[],
  answers: Record<string, string>,
  profileId: string,
  lineIndex: number,
  learnedExperiencePatterns: string[]
) => {
  const trimmed = rawLine.trim();
  if (!trimmed) return "";
  if (/^技能(?:清单)?[:：]?/.test(trimmed)) {
    // A JD or a reference case is not proof that the candidate owns a skill.
    // Keep the source skill list intact; missing skills stay as questions, not text.
    return trimmed;
  }
  if (isEntryTitle(normalizeLine(trimmed)) || sectionHeadingPattern.test(trimmed)) return trimmed;
  if (isIdentityLine(trimmed)) return trimmed;
  const shouldPolish =
    /(工作经历|实习经历|项目经历|校园项目|校园经历|个人优势|自我评价)/.test(currentSection) ||
    actionLinePattern.test(trimmed) ||
    weakResumePattern.test(trimmed);
  if (!shouldPolish) return trimmed;

  const prefix = trimmed.match(linePrefixPattern)?.[0] || "";
  const content = trimmed.slice(prefix.length);
  if (!content) return trimmed;

  const polished = polishExperienceContent(content, role, profile, learnedSkills, answers, profileId, lineIndex, learnedExperiencePatterns);
  return `${prefix}${polished}`;
};

const optimizeResumeKeepingOriginalFormat = (
  resume: string,
  role: string,
  profile: ReturnType<typeof roleProfile>,
  learnedSkills: string[],
  learnedExperiencePatterns: string[],
  summary: string,
  answers: Record<string, string>,
  profileId: string
) => {
  const sourceLines = resume.split(/\r?\n/);
  let currentSection = "";
  let experienceLineIndex = 0;

  const lines = sourceLines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return "";

    const sectionMatch = trimmed.match(sectionHeadingPattern);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      return trimmed;
    }

    const nextLine = polishLineKeepingFormat(trimmed, currentSection, role, profile, learnedSkills, answers, profileId, experienceLineIndex, learnedExperiencePatterns);
    if (nextLine !== trimmed && /(工作经历|实习经历|项目经历|校园项目|校园经历|个人优势|自我评价)/.test(currentSection)) {
      experienceLineIndex += 1;
    }
    return nextLine;
  });

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const strengthenWithCasePattern = (
  content: string,
  role: string,
  profile: ReturnType<typeof roleProfile>,
  profileId: string,
  answers: Record<string, string>,
  index: number,
  learnedExperiencePatterns: string[]
) => {
  const casePattern = learnedExperiencePatterns[index % Math.max(learnedExperiencePatterns.length, 1)] || "";
  const caseAction = extractCaseActionFrame(casePattern);
  const base = strengthenBullet(content, role, profile, profileId, answers, index, true);
  const preservedMetrics = extractMetricFragments(content, 2);
  const answerEvidence = answerTextFor(answers, ["metric", `${profileId}-result`, "role", `${profileId}-process`]);
  const resultClause = preservedMetrics.length
    ? `，保留${preservedMetrics.join("、")}等真实结果`
    : answerEvidence
      ? `，补充${sanitizeAnswer(answerEvidence)}等本人确认信息`
      : "";

  if (!caseAction) return base;
  return `${base.replace(/。$/, "")}；突出${caseAction}${resultClause}。`;
};

const extractCaseActionFrame = (line: string) => {
  const cleaned = normalizeLine(line)
    .replace(/^[-–—]\s*/, "")
    .replace(/^负责/, "")
    .replace(/^参与/, "")
    .replace(/^协助/, "")
    .replace(/^完成/, "")
    .replace(/，.*$/, "")
    .trim();
  return cleaned.length > 4 ? cleaned.slice(0, 34) : "";
};

const splitEntries = (lines: string[]) => {
  const entries: { title: string; bullets: string[] }[] = [];
  let current: { title: string; bullets: string[] } | null = null;

  lines.forEach((line) => {
    const cleaned = normalizeLine(line);
    if (!cleaned) return;

    if (isEntryTitle(cleaned) && (!actionLinePattern.test(cleaned) || /[｜|]/.test(cleaned) || /^「.+」/.test(cleaned))) {
      current = { title: cleaned, bullets: [] };
      entries.push(current);
      return;
    }

    if (!current) {
      current = { title: "", bullets: [] };
      entries.push(current);
    }
    current.bullets.push(cleaned);
  });

  return entries
    .map((entry) => ({
      title: entry.title,
      bullets: dedupeStrings(entry.bullets).slice(0, 10)
    }))
    .filter((entry) => entry.title || entry.bullets.length);
};

const formatEntries = (entries: { title: string; bullets: string[] }[], fallbackBullets: string[]) => {
  if (!entries.length) return fallbackBullets.map((item) => `- ${item}`).join("\n");

  return entries
    .map((entry) => {
      const lines = [
        entry.title,
        ...entry.bullets.map(toBullet).filter(Boolean)
      ].filter(Boolean);
      return lines.join("\n");
    })
    .join("\n");
};

const weakResumePattern = /负责相关|做活动|做运营|做数据|写页面|写代码|改 bug|沟通|协助|参与|效果还可以|熟悉相关|日常工作|完成领导安排|学习能力强/;

const extractMetricFragments = (text: string, limit = 3) =>
  dedupeStrings(
    (text.match(/[^。；;\n]*(?:\d+|%|万|千|百|提升|降低|增长|减少|累计|GMV|ROI|转化|复购|曝光|播放|下单|核销)[^。；;\n]*/g) || [])
      .map((item) => normalizeLine(item))
      .filter((item) => item.length >= 4 && item.length <= 120)
  ).slice(0, limit);

const removeWeakOpening = (line: string) =>
  normalizeLine(line)
    .replace(/设计商务/g, "设计、商务")
    .replace(/效果还可以。?$/, "")
    .replace(/^本人/, "")
    .replace(/^主要/, "")
    .replace(/^日常/, "")
    .replace(/^负责(公司|部门|团队)?/, "")
    .replace(/^参与/, "")
    .replace(/^协助/, "")
    .replace(/^做过/, "")
    .replace(/^做/, "")
    .replace(/^写过/, "")
    .replace(/^会/, "")
    .replace(/^熟悉/, "")
    .replace(/^和/, "")
    .replace(/^小程序运营，做活动页面和社群，平时会看数据。?$/, "维护小程序活动页、首页资源位和社群触达内容，跟进基础运营数据")
    .replace(/^写文案，会用Excel/, "完成活动文案撰写和 Excel 数据整理")
    .replace(/^亲子活动，和设计、商务沟通[，,。]?$/, "协同设计、商务完成亲子活动页面素材、权益说明和上线沟通")
    .replace(/^校园活动项目，负责推广，做了海报和群消息。?$/, "完成校园活动推广，包括海报文案、社群消息和报名触达")
    .replace(/[，,；;、\s]+$/, "")
    .trim();

const makeBeforeAfterExplanation = (lines: string[], role: string, profileId: string) => {
  const weakLines = dedupeStrings(lines.filter((line) => weakResumePattern.test(line) || !hasMetric(line))).slice(0, 3);
  if (!weakLines.length) return "";
  const upgraded = weakLines.map((line, index) => {
    const cleaned = removeWeakOpening(line).replace(/。$/, "");
    return [
      `原句${index + 1}：${line}`,
      `升级方向：把“${cleaned || "泛泛职责"}”改成“${roleActionVerb(profileId)} + 场景范围 + 本人动作 + ${impactNounByProfile[profileId] || impactNounByProfile.generic}”，缺失结果数据的位置保留待确认。`
    ].join("\n");
  });
  return ["优化前后对照", ...upgraded].join("\n");
};

const strengthenBullet = (
  rawLine: string,
  role: string,
  profile: ReturnType<typeof roleProfile>,
  profileId: string,
  answers: Record<string, string>,
  index: number,
  useAnswerEvidence = true
) => {
  const cleaned = removeWeakOpening(rawLine);
  const ownership = useAnswerEvidence ? answerTextFor(answers, ["role", `${profileId}-process`, `${profileId}-account`, "tech-stack"]) : "";
  const campaignAnswer = useAnswerEvidence ? answerTextFor(answers, [`${profileId}-campaign`, "ops-campaign"]) : "";
  const metricAnswer = useAnswerEvidence
    ? answerTextFor(answers, ["metric", `${profileId}-result`])
    : "";
  const difficulty = useAnswerEvidence ? answerTextFor(answers, ["difficulty", `${profileId}-quality`, "tech-quality"]) : "";
  const metricFragments = extractMetricFragments(rawLine, 2);
  const projectFrame = profile.projects[index % profile.projects.length] || profile.projects[0] || profile.focus;
  const verb = roleActionVerb(profileId);
  const metricAnswerForBullet = index === 0 ? metricAnswer : "";
  const hasUsefulMetric = hasMetric(rawLine) || metricFragments.length > 0 || Boolean(metricAnswerForBullet);
  const baseAction = index === 0 && campaignAnswer
    ? campaignAnswer.replace(/。$/, "")
    : cleaned && cleaned.length >= 8
      ? cleaned.replace(/。$/, "")
      : projectFrame;
  const roleClause = /岗位|目标岗位/.test(profile.focus) ? role : profile.focus;
  const impact = impactNounByProfile[profileId] || impactNounByProfile.generic;
  const outputAsset = outputAssetByProfile[profileId] || outputAssetByProfile.generic;
  const actionPhrase = /^(完成|开发|设计|优化|维护|搭建|建立|输出|推动|处理|分析|策划|统筹)/.test(baseAction)
    ? baseAction
    : `${verb}${baseAction}`;

  if (hasUsefulMetric) {
    const metricText = metricFragments.length ? `，保留${metricFragments.join("、")}等可验证结果` : "";
    const answerText = metricAnswerForBullet ? `；补充证据：${metricAnswerForBullet}` : "";
    return `${actionPhrase}；围绕${roleClause}目标，覆盖${projectFrame}，持续跟踪${impact}${metricText}${answerText}。`;
  }

  const ownershipText = ownership && index <= 1 ? `；本人负责${sanitizeAnswer(ownership)}` : "";
  const difficultyText = difficulty && index === 1 ? `；针对${sanitizeAnswer(difficulty)}进行问题定位和页面信息优化` : "";
  return `${actionPhrase}；围绕${roleClause}目标，覆盖${projectFrame}，跟踪${impact}${ownershipText}${difficultyText}；${outputAsset}。`;
};

const formatStrongEntries = (
  entries: { title: string; bullets: string[] }[],
  fallbackBullets: string[],
  role: string,
  profile: ReturnType<typeof roleProfile>,
  profileId: string,
  answers: Record<string, string>,
  useAnswerEvidence = true
) => {
  const sourceEntries = entries.length ? entries : [{ title: "", bullets: fallbackBullets }];
  return sourceEntries
    .map((entry) => {
      const strengthened = dedupeStrings(entry.bullets)
        .filter((line) => !isResumeMetaLine(line))
        .slice(0, 5)
        .map((line, index) => `- ${strengthenBullet(line, role, profile, profileId, answers, index, useAnswerEvidence)}`);
      return [entry.title, ...strengthened].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n");
};

const extractJdTerms = (role: string, jd: string, profile: ReturnType<typeof roleProfile>) => {
  const source = `${role} ${jd}`;
  const terms = [
    ...profile.skills,
    ...keywordBank,
    ...(source.match(/[A-Za-z][A-Za-z0-9+#.]{1,}|[\u4e00-\u9fa5]{2,8}/g) || [])
  ];
  return dedupeStrings(terms)
    .filter((term) => source.toLowerCase().includes(term.toLowerCase()))
    .filter((term) => !/岗位职责|任职要求|负责|优先|相关|能力|工作|经验|要求|以上|熟悉|具备/.test(term))
    .slice(0, 12);
};

const formatSkillGroups = (skills: string[], profile: ReturnType<typeof roleProfile>, missingKeywords: string[]) => {
  const confirmed = dedupeStrings(skills.filter((item) => !missingKeywords.includes(item))).slice(0, 10);
  const lines = [
    confirmed.length ? `- 岗位相关能力：${confirmed.join("、")}` : "",
    `- 核心工作方法：${profile.projects.slice(0, 3).join("；")}`
  ].filter(Boolean);
  return lines.join("\n");
};

const buildEvidenceMap = (
  role: string,
  jdTerms: string[],
  resume: string,
  answers: Record<string, string>,
  profileId: string
) => {
  const answerEvidence = Object.values(answers).filter(Boolean).join("；");
  const source = `${resume}\n${answerEvidence}`;
  const mapped = jdTerms.slice(0, 8).map((term) => {
    const matchedLine = source
      .split(/\n|。|；|;/)
      .map((line) => normalizeLine(line))
      .filter((line) => line && !isResumeMetaLine(line) && !sectionHeadingPattern.test(line) && !isEntryTitle(line))
      .find((line) => line.includes(term) || (term.length > 2 && line.includes(term.slice(0, 2))));
    if (matchedLine) return `- ${term}：已有线索“${matchedLine.slice(0, 62)}”，成稿需改成动作、范围、结果都清楚的岗位证据。`;
    return `- ${term}：[待确认] 如你确有${term}相关经历，请补充场景、本人动作和${metricHintByProfile[profileId] || metricHintByProfile.generic}。`;
  });
  return mapped.length
    ? mapped.join("\n")
    : `- ${role}：[待确认] 请补充最相关的一段经历，写清背景、本人动作、结果和可验证证据。`;
};

const formatFallbackBullets = (lines: string[], limit = 12) =>
  dedupeStrings(lines)
    .slice(0, limit)
    .map(toBullet)
    .filter(Boolean)
    .join("\n");

export function analyzeResume(input: ResumeInput): AnalysisReport {
  const resume = input.resumeText || "";
  const jd = input.jobDescription || "";
  const isAdsContext = /信息流|投放|巨量|引擎|优化师|广告|账户|计划|出价|素材|ROI|消耗|投产|ocpc|千川/.test(`${input.targetRole} ${jd}`);
  const irrelevantAdsKeywords = new Set(["设计", "产品", "需求", "前端", "后端", "React", "TypeScript", "JavaScript", "Python", "SQL"]);
  const matchedKeywords = keywordBank.filter(
    (word) =>
      resume.toLowerCase().includes(word.toLowerCase()) &&
      jd.toLowerCase().includes(word.toLowerCase())
  );
  const missingKeywords = keywordBank
    .filter(
      (word) =>
        jd.toLowerCase().includes(word.toLowerCase()) &&
        !resume.toLowerCase().includes(word.toLowerCase()) &&
        (!isAdsContext || !irrelevantAdsKeywords.has(word))
    )
    .slice(0, 8);

  const rubric = scoreWithResumlRubric({
    resume,
    jobDescription: jd,
    matchedKeywords,
    missingKeywords,
    hasTargetTitle: Boolean(input.targetRole.trim()) && resume.toLowerCase().includes(input.targetRole.trim().toLowerCase())
  });
  const score = rubric.score;

  const issues = [
    rubric.quantification < 100 ? "量化证据覆盖不足：参考项目要求至少一半经历要带真实数字或结果。" : "",
    missingKeywords.length ? `岗位里提到 ${missingKeywords.slice(0, 3).join("、")}，简历里还可以补对应经历。` : "",
    rubric.sectionCount < 3 ? "标准简历区块不完整：需要至少包含工作/项目、教育和技能等常规栏目。" : "",
    !rubric.hasContact ? "联系方式不完整：请补充可解析的手机号或邮箱。" : "",
    !/负责|参与|独立|主导|协作|优化|搭建/.test(resume)
      ? "个人动作不够清晰，需要说明你具体负责哪一段。"
      : ""
  ].filter(Boolean);
  const skillLabels = skillLabelsFor(`${input.targetRole} ${jd}`);

  return {
    score,
    level: score >= 82 ? "高" : score >= 62 ? "中" : "低",
    matchedKeywords: matchedKeywords.slice(0, 10),
    missingKeywords,
    strengths: [
      matchedKeywords.length ? "已有内容能对上部分岗位要求。" : "已有经历可以继续向目标岗位靠拢。",
      hasMetric(resume) ? "简历里已经出现结果数据，适合继续强化表达。" : "经历框架已具备，下一步重点补真实证据。",
      "补齐关键证据后，可以形成更贴合岗位的投递稿。"
    ],
    issues: issues.length ? issues : ["整体基础可以，下一步主要补个人贡献和可验证结果。"],
    fixes: [
      "优先把最匹配目标岗位的项目放到前面。",
      "仅在确有对应经历时补齐 JD 缺少的关键词，并放在技能或项目证据中。",
      "让至少一半经历写出真实的数字、范围或结果。",
      "每条经历以清晰动作开头，删除和目标岗位关系较弱的泛泛描述。"
    ],
    skillScores: skillLabels.map((label) => ({
      label,
      score: resume.includes(label)
        ? jd.includes(label)
          ? 88
          : 76
        : jd.includes(label)
          ? 52
          : 64
    })),
    matchItems: buildMatchItems(`${input.targetRole}、${input.jobDescription}`, resume)
  };
}

export function generateFollowUpQuestions(input: ResumeInput, report: AnalysisReport): FollowUpQuestion[] {
  const candidateType = input.candidateType || (/应届|在校|毕业生/.test(input.resumeText) ? "graduate" : "experienced");
  const roleCategory = classifyRole(input.targetRole, input.jobDescription);
  const guided = buildEvidenceQuestions(roleCategory, candidateType);
  if (candidateType === "graduate" || roleCategory !== "functional") {
    const enhanced = [...guided.map((item) => ({ ...item }))];
    return addGapAwareQuestions(enhanced, input, report);
  }
  const jd = `${input.targetRole} ${input.jobDescription}`;
  const profile = questionProfileFor(jd);
  const base: FollowUpQuestion[] = [
    {
      id: "metric",
      question: profile.metricQuestion,
      reason: profile.metricReason
    },
    {
      id: "role",
      question: profile.roleQuestion,
      reason: profile.roleReason
    },
    {
      id: "difficulty",
      question: profile.difficultyQuestion,
      reason: profile.difficultyReason
    }
  ];

  base.push(...profile.specificQuestions);

  return addGapAwareQuestions(dedupeQuestions(base).slice(0, 6), input, report);
}

function addGapAwareQuestions(base: FollowUpQuestion[], input: ResumeInput, report: AnalysisReport): FollowUpQuestion[] {
  const result = [...base];
  const resumeText = input.resumeText.toLowerCase();
  const jdText = (input.jobDescription || "").toLowerCase();

  // 检测简历中是否完全没有量化数字
  const hasNumbers = /\b\d{2,}\b/.test(input.resumeText);
  if (!hasNumbers && !result.some((q) => q.id === "no-metrics")) {
    result.push({
      id: "no-metrics",
      question: "你的简历目前没有任何量化结果。回看最近一段经历：有没有处理量、完成数、提升比例、节省时间、服务人数等具体数字？哪怕是一个大概区间也可以。",
      reason: "量化结果是简历说服力的核心，这是当前最需要补的内容。"
    });
  }

  // 检测 JD 中要求的工具/技能，如果简历中没有
  const techKeywords = ["React", "Vue", "TypeScript", "JavaScript", "Python", "SQL", "Java", "Figma", "Excel", "Tableau", "Power BI", "Jira", "Git", "Docker", "Kubernetes", "Photoshop", "Premiere", "剪映", "Axure", "SPSS", "Stata"];
  const missingTools = techKeywords.filter((kw) => {
    const lower = kw.toLowerCase();
    return jdText.includes(lower) && !resumeText.includes(lower);
  }).slice(0, 3);

  if (missingTools.length && !result.some((q) => q.id === "missing-tools")) {
    result.push({
      id: "missing-tools",
      question: `岗位要求中提到 ${missingTools.join("、")}，你的简历中没有体现。你是否实际用过其中某项？在什么场景下使用的？`,
      reason: "补齐岗位要求的工具/技能证据，避免在关键词筛选中被淘汰。"
    });
  }

  // 针对 missingKeywords 生成更具体的问题
  if (report.missingKeywords.length) {
    const topGaps = report.missingKeywords.slice(0, 4);
    const existingKeywordQuestion = result.findIndex((q) => q.id === "keywords");
    if (existingKeywordQuestion >= 0) {
      result[existingKeywordQuestion] = {
        id: "keywords",
        question: `目标岗位很看重 ${topGaps.join("、")}。请选其中一项你有真实经历的，具体说说你在什么场景下做了什么、结果如何。`,
        reason: "每条缺失的关键词背后都对应一个招聘筛选条件，补上最有把握的一条即可大幅提高匹配度。"
      };
    } else {
      result.push({
        id: "keywords",
        question: `目标岗位很看重 ${topGaps.join("、")}。请选其中一项你有真实经历的，具体说说你在什么场景下做了什么、结果如何。`,
        reason: "每条缺失的关键词背后都对应一个招聘筛选条件，补上最有把握的一条即可大幅提高匹配度。"
      });
    }
  }

  return result.slice(0, 8);
}

export function generateOptimizedResume(
  input: ResumeInput,
  report: AnalysisReport,
  answers: Record<string, string>
): OptimizedResume {
  const role = input.targetRole || "目标岗位";
  const evidence = Object.values(answers).filter(Boolean).join("；");
  const keywords = report.matchedKeywords.filter(Boolean);
  const profile = roleProfile(role, input.jobDescription);
  const profileId = questionProfileFor(`${role} ${input.jobDescription}`).id;
  const resume = input.resumeText || "";
  const learnedCases = getRelevantSampleCases(role, input.jobDescription, resume);
  const learnedCaseNames = learnedCases.map((item) => item.title).join("、");
  const learnedExperiencePatterns = dedupeStrings([
    ...extractExperienceLinesFromCases(learnedCases, ["工作经历", "实习经历"]),
    ...extractExperienceLinesFromCases(learnedCases, ["项目经历", "校园经历"])
  ]).slice(0, 12);
  const header = extractResumeHeader(input);
  const workSectionLines = [
    ...getSectionBody(resume, ["工作经历"]),
    ...getSectionBody(resume, ["实习经历"])
  ];
  const projectSectionBodyLines = dedupeStrings([
    ...getSectionBody(resume, ["项目经历"]),
    ...getSectionBody(resume, ["校园项目"]),
    ...getSectionBody(resume, ["校园实践"]),
    ...getSectionBody(resume, ["校园经历"])
  ]);
  const workEntries = splitEntries(workSectionLines);
  const projectEntries = splitEntries(projectSectionBodyLines);
  const projectLineSet = new Set(projectSectionBodyLines.map((line) => normalizeLine(line)));
  const workLines = workSectionLines.length
    ? workSectionLines.filter((line) => actionLinePattern.test(line)).slice(0, 18)
    : dedupeStrings([
      ...pickExperienceLines(resume, 12),
      ...getRelevantLines(resume, 12)
    ]).filter((line) => !projectLineSet.has(normalizeLine(line))).slice(0, 18);
  const metricLines = pickLines(resume, /(\d+|%|万|千|提升|增长|降低|累计|订单|GMV|转化|复购|访问|曝光)/, 6)
    .filter((line) => !isResumeMetaLine(line));
  const projectLines = projectSectionBodyLines.length
    ? projectSectionBodyLines
    : pickLines(resume, /项目|活动|小程序|商城|系统|平台|专题|会员|社群|投放|账户|素材/, 4)
      .filter((line) => !isResumeMetaLine(line));
  const educationLines = getEducationLines(resume).map(toBullet);
  const trustedSkills = dedupeStrings(keywords);
  const summary = getResumeSummary(role, profile, trustedSkills);
  const explicitSkillLine = findSkillLine(resume);
  const normalizedEvidence = evidence || "当前未填写补充回答；正式投递前，请补齐至少一组你能解释清楚的真实数据或项目细节。";
  const pendingWorkLines: string[] = [];
  const keyWork = workLines.length
    ? workLines.map(toBullet).filter(Boolean).join("\n")
    : pendingWorkLines.map(toBullet).filter(Boolean).join("\n");
  const workExperience = formatEntries(
    workEntries,
    workLines.length ? workLines : pendingWorkLines
  );
  const hasExplicitProjectSection = projectSectionBodyLines.length > 0;
  const projectExperience = projectEntries.length
    ? formatEntries(projectEntries, [])
    : hasExplicitProjectSection
      ? formatFallbackBullets(projectLines, 12)
      : "";
  const jdTerms = extractJdTerms(role, input.jobDescription, profile);
  const learnedSkills = extractSkillsFromCases(learnedCases).slice(0, 8);
  const allSkillTerms = dedupeStrings([...trustedSkills, ...profile.skills, ...learnedSkills, ...jdTerms]).slice(0, 18);
  // This is the publishable-rebuild path for a weak source resume.  It uses
  // only source lines: the transformation may clarify an action or add a
  // bullet, but it never adds a company, tool, result, or project detail.
  const formatSourceEntries = (entries: { title: string; bullets: string[] }[], fallback: string[]) => {
    const sourceEntries = entries.length ? entries : [{ title: "", bullets: fallback }];
    return sourceEntries
      .map((entry) => [
        entry.title,
        ...dedupeStrings(entry.bullets)
          .filter((line) => !isResumeMetaLine(line))
          .slice(0, 8)
          .map((line, index) => `- ${polishExperienceContent(line, role, profile, learnedSkills, answers, profileId, index, learnedExperiencePatterns)}`)
      ].filter(Boolean).join("\n"))
      .filter(Boolean)
      .join("\n");
  };
  const rebuiltWorkExperience = formatSourceEntries(workEntries, workLines);
  const rebuiltProjectExperience = hasExplicitProjectSection
    ? formatSourceEntries(projectEntries, projectLines)
    : "";
  const resultEvidence = metricLines.length
    ? `\n\n已保留原简历中的量化证据：${dedupeStrings(metricLines).slice(0, 4).join("；")}`
    : "";
  const skillText = explicitSkillLine
    ? explicitSkillLine.replace(/^(?:专业)?技能(?:清单)?[:：]?\s*/, "")
    : trustedSkills.length
      ? trustedSkills.join("、")
      : "请从原简历中补充你真实使用过的工具、方法或专业能力";
  const strongWorkExperience = rebuiltWorkExperience || workExperience;
  const strongProjectExperience = rebuiltProjectExperience || projectExperience;
  const needsMajorRewrite = weakResumePattern.test(resume) || resume.length < 520 || workLines.some((line) => !hasMetric(line));
  const beforeAfterExplanation = makeBeforeAfterExplanation(workLines.length ? workLines : getRelevantLines(resume, 8), role, profileId);
  const formatPreservingText = optimizeResumeKeepingOriginalFormat(resume, role, profile, learnedSkills, learnedExperiencePatterns, summary, answers, profileId);
  const rebuiltText = [
    header.name,
    `求职目标：${header.target || role}`,
    header.contactLine,
    "",
    strongWorkExperience ? ["工作经历", strongWorkExperience, ""].join("\n") : "",
    strongProjectExperience ? ["项目经历", strongProjectExperience, ""].join("\n") : "",
    skillText ? ["技能", `- ${skillText}`, ""].join("\n") : "",
    educationLines.length ? formatSection("教育经历", educationLines) : ""
  ].filter((part) => part !== "").join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const fullText = needsMajorRewrite ? rebuiltText : (formatPreservingText || rebuiltText);

  const blocks = [
    {
      title: "个人简介",
      before: "原简历未单独整理个人优势，容易把姓名、求职意向和经历混在一起。",
      after: summary
    },
    {
      title: "工作/项目经历",
      before: workLines.length ? workLines.slice(0, 3).join("\n") : "暂无清晰工作/项目经历。",
      after: `围绕${role}要求，重点呈现${profile.focus}相关任务：\n${(strongWorkExperience || keyWork).slice(0, 520)}${resultEvidence}\n\n下一步可强化证据：${normalizedEvidence}`.slice(0, 760)
    },
    {
      title: "弱句升级逻辑",
      before: "负责、参与、协助、做过、效果还可以。",
      after: beforeAfterExplanation || "本次原稿已有一定结构，主要按岗位优先级重排内容并补证据提示。"
    },
    {
      title: "优秀案例学习",
      before: learnedCaseNames || "暂无匹配案例。",
      after: learnedCases.length
        ? `可参考 ${learnedCases.length} 个相似案例的结构和证据颗粒度；案例只作为写法参考，不会把他人的项目、数字或公司经历写进你的成稿。`
        : "当前岗位案例匹配较少，优先按岗位描述和原简历内容优化。"
    },
    {
      title: "技能清单",
      before: report.matchedKeywords.join("、") || "技能关键词不明显。",
      after: skillText || "岗位关键词、工具技能、项目能力、沟通协作"
    }
  ];

  return {
    summary,
    skills: Array.from(new Set([...trustedSkills, ...report.missingKeywords.map((item) => `待确认：${item}`)])).slice(0, 14),
    blocks,
    fullText,
    interviewScript: [
      `我正在投递${role}，过往经历中和岗位最相关的是${profile.focus}相关的执行、协作和复盘。`,
      "如果面试官追问项目细节，可以按“背景、任务、行动、结果”的顺序回答。",
      evidence ? `可重点展开的证据：${evidence}` : "建议补充一个最有代表性的项目数据，作为面试时的主要案例。",
      "正式投递前，只保留能够确认真实性的数据；不确定的数据先删掉或改成区间。"
    ]
  };
}
