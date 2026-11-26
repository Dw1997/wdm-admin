// 顶部全局搜索的功能索引：只收录 src/router/index.ts 已挂载的页面，以及 MainLayout 提供的快捷操作

export type SearchFeatureAction = 'change-password' | 'toggle-theme'

export interface SearchFeatureItem {
  /** 页面用路由路径（如 '/order-center/create'），快捷动作用 'action:xxx' */
  id: string
  label: string
  /** 所属一级模块名，用于下拉分组 */
  group: string
  /** 简短功能说明，用于下拉副标题 */
  description: string
  /** 业务别名、页面内子功能词、常用拼音首字母 */
  keywords: string[]
  path?: string
  action?: SearchFeatureAction
  adminOnly?: boolean
}

const SEARCH_FEATURES: SearchFeatureItem[] = [
  {
    id: '/dashboard',
    label: '数据看板',
    group: '数据看板',
    description: '经营概览、销售趋势与排行',
    keywords: ['首页', '经营看板', '经营总览', '销售趋势', '营业额', '排行榜', '数据统计', 'sjkb', 'sykb', 'sy'],
    path: '/dashboard',
  },

  // 订单中心
  {
    id: '/order-center/counter',
    label: '门店零售',
    group: '订单中心',
    description: '收银台开单，散客与门店零售',
    keywords: ['收银', '收银台', '散客', '零售', '门店销售', '零售单', 'pos', '开单', '现货', 'mdls', 'sy'],
    path: '/order-center/counter',
  },
  {
    id: '/order-center/create',
    label: '录单',
    group: '订单中心',
    description: '代客录单，批发开单',
    keywords: ['开单', '批发录单', '代客下单', '电话订单', '电话报单', '业务员录单', '录订单', 'ld', 'kd'],
    path: '/order-center/create',
  },
  {
    id: '/order-center/list',
    label: '订单列表',
    group: '订单中心',
    description: '查询与管理全部销售订单',
    keywords: ['订单管理', '全部订单', '销售订单', '查订单', '订单查询', 'ddlb', 'dd'],
    path: '/order-center/list',
  },
  {
    id: '/order-center/approvals',
    label: '订单审批',
    group: '订单中心',
    description: '审核待审批订单（仅管理员）',
    keywords: ['审批', '订单审核', '待审批', '审核订单', '同意', '驳回', 'ddsp', 'sp'],
    path: '/order-center/approvals',
    adminOnly: true,
  },
  {
    id: '/order-center/refund',
    label: '退货单',
    group: '订单中心',
    description: '查询退货单与审核退货',
    keywords: ['退货', '退单', '退款单', '售后', '退货记录', 'thd', 'th'],
    path: '/order-center/refund',
  },
  {
    id: '/order-center/refund/new',
    label: '新建退货单',
    group: '订单中心',
    description: '创建退货申请与退货单',
    keywords: ['退货开单', '新建退货', '退货申请', '退货登记', '录退货', 'xjthd'],
    path: '/order-center/refund/new',
  },
  {
    id: '/order-center/print',
    label: '打印中心',
    group: '订单中心',
    description: '批量打印销售单与拣货单（仅管理员）',
    keywords: ['打印', '打单', '拣货单', '捡货单', '销售单', '送货单', '小票', '补打', 'dyzx', 'dy'],
    path: '/order-center/print',
    adminOnly: true,
  },

  // 商品中心
  {
    id: '/spus/create',
    label: '新建商品',
    group: '商品中心',
    description: '录入商品、规格与图片',
    keywords: ['新增商品', '添加商品', '商品录入', '上架商品', '新建 spu', 'xjsp'],
    path: '/spus/create',
  },
  {
    id: '/spus/list',
    label: '商品管理',
    group: '商品中心',
    description: '商品列表、上下架与编辑',
    keywords: ['商品列表', '商品维护', 'spu', 'sku', '上下架', '商品资料', 'spgl', 'splb'],
    path: '/spus/list',
  },
  {
    id: '/spus/categories',
    label: '分类管理',
    group: '商品中心',
    description: '维护四级商品分类',
    keywords: ['商品分类', '类目', '分类树', '四级分类', 'flgl', 'fl'],
    path: '/spus/categories',
  },

  // 价格体系
  {
    id: '/prices/suggested',
    label: '建议价格',
    group: '价格体系',
    description: '设置商品建议售价与定价规则',
    keywords: ['指导价', '建议零售价', '售价', '定价', '最低售价', 'jgjg', 'jgj'],
    path: '/prices/suggested',
  },
  {
    id: '/prices/levels',
    label: '等级价格',
    group: '价格体系',
    description: '按客户等级配置价格',
    keywords: ['等级定价', '客户等级价', '会员价', '折扣', '等级折扣', 'djjg', 'dj'],
    path: '/prices/levels',
  },
  {
    id: '/prices/exclusive',
    label: '专属价格',
    group: '价格体系',
    description: '为客户单独设置专属价',
    keywords: ['客户专属价', '协议价', '一口价', '客户定价', '特价', 'zsjg', 'zysj'],
    path: '/prices/exclusive',
  },
  {
    id: '/prices/query',
    label: '价格查询',
    group: '价格体系',
    description: '按客户查询成交价',
    keywords: ['查价格', '报价查询', '客户价查询', '成交价', 'jgcx', 'cx'],
    path: '/prices/query',
  },

  // 进货管理
  {
    id: '/inventory/purchase-plans',
    label: '采购清单',
    group: '进货管理',
    description: '根据库存生成补货采购计划',
    keywords: ['采购计划', '补货', '要货清单', '缺货', '进货清单', 'cgqd', 'bh'],
    path: '/inventory/purchase-plans',
  },
  {
    id: '/inventory/purchases',
    label: '采购入库',
    group: '进货管理',
    description: '登记进货收货与入库成本',
    keywords: ['进货入库', '收货', '入库单', '采购收货', '采购单', 'cgrk', 'rk'],
    path: '/inventory/purchases',
  },
  {
    id: '/inventory/stocks',
    label: '库存查询',
    group: '进货管理',
    description: '查看库存数量与流水',
    keywords: ['库存', '盘点', '库存量', '库存流水', 'stock', 'kc', 'kccx'],
    path: '/inventory/stocks',
  },
  {
    id: '/suppliers/list',
    label: '供应商管理',
    group: '进货管理',
    description: '维护供应商资料',
    keywords: ['供应商', '厂商', '供货商', '进货商', 'gys', 'gysgl'],
    path: '/suppliers/list',
  },

  // 客户管理
  {
    id: '/customers/list',
    label: '客户列表',
    group: '客户管理',
    description: '客户档案与基础信息',
    keywords: ['客户', '客户档案', '客户资料', '会员', 'kh', 'khlb'],
    path: '/customers/list',
  },
  {
    id: '/customers/credit',
    label: '客户额度',
    group: '客户管理',
    description: '调整客户授信额度与账期',
    keywords: ['调额', '赊账', '额度', '授信', '信用额度', '提额', '降额', 'ed', 'khd'],
    path: '/customers/credit',
  },
  {
    id: '/customers/audit',
    label: '客户审核',
    group: '客户管理',
    description: '审核新注册客户',
    keywords: ['审核客户', '注册审核', '开户审核', '客户认证', '通过审核', 'khsh'],
    path: '/customers/audit',
  },
  {
    id: '/customers/tags',
    label: '客户标签',
    group: '客户管理',
    description: '维护客户标签分组',
    keywords: ['标签', '客户分组', '打标签', '客户分类', 'khbq', 'bq'],
    path: '/customers/tags',
  },
  {
    id: '/customers/coupons',
    label: '优惠券管理',
    group: '客户管理',
    description: '发放优惠券与查看核销记录',
    keywords: ['发券', '优惠券', '满减券', '代金券', '核销', '券模板', '发放优惠券', 'yhq', 'fq'],
    path: '/customers/coupons',
  },

  // 配送管理
  {
    id: '/delivery/trips',
    label: '安排出车',
    group: '配送管理',
    description: '安排配送趟次与出车',
    keywords: ['出车', '排车', '配送', '趟次', '线路配送', '送货路线', 'apcc', 'cc'],
    path: '/delivery/trips',
  },
  {
    id: '/delivery/trips/new',
    label: '新建出车',
    group: '配送管理',
    description: '创建新的配送趟次',
    keywords: ['新增出车', '新建趟次', '安排车辆', '排车', '新建配送', 'xjcc'],
    path: '/delivery/trips/new',
  },
  {
    id: '/delivery/pool',
    label: '待送货订单',
    group: '配送管理',
    description: '待分配配送的订单池',
    keywords: ['待配送', '未送货', '送货池', '派单', '待派送', '配送池', 'dshdd', 'ps'],
    path: '/delivery/pool',
  },
  {
    id: '/delivery/places',
    label: '路线设置',
    group: '配送管理',
    description: '维护送货区域与地点',
    keywords: ['送货地点', '乡镇', '区域', '线路设置', '配送区域', 'lxsz', 'shdd'],
    path: '/delivery/places',
  },
  {
    id: '/delivery/freight-lines',
    label: '物流路线',
    group: '配送管理',
    description: '配置物流专线与运费',
    keywords: ['物流', '货运', '专线', '托运', '物流专线', '运费', 'wl'],
    path: '/delivery/freight-lines',
  },

  // 销售管理
  {
    id: '/sales/dashboard',
    label: '销售看板',
    group: '销售管理',
    description: '业务员业绩与销售趋势',
    keywords: ['业务员看板', '业绩', '销售报表', '销售统计', '业务看板', 'xskb', 'yj'],
    path: '/sales/dashboard',
  },
  {
    id: '/sales/list',
    label: '销售列表',
    group: '销售管理',
    description: '维护销售员账号',
    keywords: ['业务员', '销售员', '销售管理', '销售账号', 'xsy', 'ywy'],
    path: '/sales/list',
  },
  {
    id: '/sales/commission-settings',
    label: '提成设置',
    group: '销售管理',
    description: '配置销售提成规则',
    keywords: ['佣金', '提点', '提成规则', '提成比例', 'tcsz', 'tc'],
    path: '/sales/commission-settings',
  },

  // 财务结算
  {
    id: '/finance/commissions',
    label: '销售提成',
    group: '财务结算',
    description: '结算销售提成',
    keywords: ['提成', '佣金', '提成结算', '工资', 'xstc', 'tc'],
    path: '/finance/commissions',
  },
  {
    id: '/finance/credit',
    label: '客户账期',
    group: '财务结算',
    description: '应收账款与账期管理',
    keywords: ['应收账款', '账期', '欠款', '对账', '应收', '平账', '抹零', '收款登记', 'ar', 'khzq'],
    path: '/finance/credit',
  },
  {
    id: '/finance/payments',
    label: '支付记录',
    group: '财务结算',
    description: '收款登记与支付流水',
    keywords: ['收款', '微信支付', '收款登记', '支付流水', '付款记录', '收款记录', 'zfjl', 'sk'],
    path: '/finance/payments',
  },
  {
    id: '/suppliers/transactions',
    label: '供应商往来',
    group: '财务结算',
    description: '应付款与往来对账',
    keywords: ['应付', '对冲', '应付款', '供应商账单', '往来账', '付款', 'gyswl', 'yf'],
    path: '/suppliers/transactions',
  },
  {
    id: '/finance/cost-center',
    label: '成本中心',
    group: '财务结算',
    description: '经营成本与月度利润',
    keywords: ['成本', '费用', '毛利', '利润', '经营成本', '月度利润', 'cbzx', 'fy'],
    path: '/finance/cost-center',
  },

  // 系统管理
  {
    id: '/system/accounts',
    label: '账户管理',
    group: '系统管理',
    description: '管理后台登录账号',
    keywords: ['账号', '员工账号', '用户管理', '密码', '新增账号', 'zhgl', 'zh'],
    path: '/system/accounts',
  },
  {
    id: '/system/roles',
    label: '角色管理',
    group: '系统管理',
    description: '配置角色与功能权限',
    keywords: ['权限', '角色权限', '功能权限', '角色配置', 'jsgl', 'qx'],
    path: '/system/roles',
  },
  {
    id: '/system/audit-logs',
    label: '操作审计',
    group: '系统管理',
    description: '查看操作日志',
    keywords: ['审计', '操作日志', '日志', '登录日志', '操作记录', 'czsj', 'rz'],
    path: '/system/audit-logs',
  },

  // 快捷操作
  {
    id: 'action:change-password',
    label: '修改密码',
    group: '快捷操作',
    description: '修改当前登录账号的密码',
    keywords: ['改密码', '密码', '重置密码', '修改登录密码', 'xgmm', 'mm'],
    action: 'change-password',
  },
  {
    id: 'action:toggle-theme',
    label: '切换深色/浅色模式',
    group: '快捷操作',
    description: '在深色与浅色主题之间切换',
    keywords: ['主题', '深色模式', '浅色模式', '暗黑模式', '夜间模式', '换肤', '主题切换', 'qhzt', 'zt'],
    action: 'toggle-theme',
  },
]

/** 按角色过滤：非管理员不返回 adminOnly 项 */
export function getSearchFeatures(isAdmin: boolean): SearchFeatureItem[] {
  return isAdmin ? SEARCH_FEATURES : SEARCH_FEATURES.filter((item) => !item.adminOnly)
}

/** 空格分词多关键词 AND 匹配，大小写不敏感，覆盖 label / group / description / keywords / path */
export function matchSearchFeature(item: SearchFeatureItem, query: string): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!tokens.length) return true
  const haystack = [item.label, item.group, item.description, item.path ?? '', ...item.keywords]
    .join(' ')
    .toLowerCase()
  return tokens.every((token) => haystack.includes(token))
}

export interface SearchFeatureOption {
  label: string
  value: string
  description: string
  group: string
  path?: string
  action?: SearchFeatureAction
}

export interface SearchFeatureOptionGroup {
  type: 'group'
  key: string
  label: string
  children: SearchFeatureOption[]
}

/** 按 group 分组，保持 SEARCH_FEATURES 的定义顺序；传 query 时只保留命中项 */
export function buildFeatureOptionGroups(isAdmin: boolean, query = ''): SearchFeatureOptionGroup[] {
  const groups: SearchFeatureOptionGroup[] = []
  const groupIndex = new Map<string, SearchFeatureOptionGroup>()
  const hasQuery = query.trim().length > 0

  for (const item of getSearchFeatures(isAdmin)) {
    if (hasQuery && !matchSearchFeature(item, query)) continue
    let group = groupIndex.get(item.group)
    if (!group) {
      group = { type: 'group', key: item.group, label: item.group, children: [] }
      groupIndex.set(item.group, group)
      groups.push(group)
    }
    group.children.push({
      label: item.label,
      value: item.id,
      description: item.description,
      group: item.group,
      path: item.path,
      action: item.action,
    })
  }
  return groups
}
