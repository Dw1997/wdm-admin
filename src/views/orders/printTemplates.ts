// 打印中心单据模板：销售单（针式 241×140 / 241×280）与捡货单（A4）。
// 只生成 HTML 字符串，打印动作在 utils/print.ts；版式见 docs/01-features/web-admin/订单中心/打印中心.md。
import type { PickingItem, PickingResult, SalesNote, SalesNoteItem } from '@/types'

export type SalesPaper = 'half' | 'full'

export interface SalesPrintOptions {
  shopName: string
  shopPhone?: string
  shopAddress?: string
  printedAt: string
  operatorName?: string
  paper: SalesPaper
}

export interface PickingPrintOptions {
  scopeLabel: string
  printedAt: string
  operatorName?: string
}

const LABEL: Record<string, string> = {
  route_call: '线路询单',
  phone_in: '客户来电',
  miniprogram: '小程序',
  counter: '门店零售',
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 数量：整数不带小数，有小数保留 1 位。 */
export function formatQty(value: string | number): string {
  const num = Number(value ?? 0)
  if (!Number.isFinite(num)) return '0'
  return Number.isInteger(num) ? String(num) : num.toFixed(1)
}

export function formatMoney(value: string | number): string {
  return Number(value ?? 0).toFixed(2)
}

/** 应收金额转中文大写（只做格式转换，不重算金额）。 */
export function rmbUpper(value: string | number): string {
  const digits = '零壹贰叁肆伍陆柒捌玖'
  const units = ['', '拾', '佰', '仟']
  const groups = ['', '万', '亿']
  const [intPart, decPart] = Number(value ?? 0).toFixed(2).split('.')
  let rest = parseInt(intPart, 10)
  let text = ''
  let group = 0
  if (rest === 0) text = '零'
  while (rest > 0) {
    let chunk = rest % 10000
    let chunkText = ''
    let hasZero = false
    for (let pos = 0; pos < 4; pos += 1) {
      const digit = chunk % 10
      if (digit === 0) {
        if (chunkText && !hasZero) {
          chunkText = `零${chunkText}`
          hasZero = true
        }
      } else {
        chunkText = `${digits[digit]}${units[pos]}${chunkText}`
        hasZero = false
      }
      chunk = Math.floor(chunk / 10)
    }
    if (chunkText) text = `${chunkText}${groups[group]}${text}`
    rest = Math.floor(rest / 10000)
    group += 1
  }
  text = text.replace(/零+$/, '') || '零'
  const jiao = Number(decPart[0])
  const fen = Number(decPart[1])
  let result = `${text}元`
  if (!jiao && !fen) return `${result}整`
  if (jiao) result += `${digits[jiao]}角`
  else if (fen) result += '零'
  if (fen) result += `${digits[fen]}分`
  return result
}

function payMethodText(note: SalesNote): string {
  const map: Record<string, string> = { wechat: '微信', alipay: '支付宝', cash: '现金', other: '其他' }
  return map[note.payment_method || ''] || '—'
}

// ---------- 销售单 ----------

const SALES_CSS = `
@page { size: 241mm 140mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: "PingFang SC", "Microsoft YaHei", "Songti SC", sans-serif; color: #000; }
.sheet {
  width: 241mm; height: 140mm; padding: 4mm 6mm 3mm;
  display: flex; flex-direction: column; overflow: hidden;
  page-break-after: always; break-after: page;
}
.sheet:last-child { page-break-after: auto; break-after: auto; }
.n-head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 0.5mm solid #000; padding-bottom: 1mm; }
.n-shop { font-size: 14pt; font-weight: 800; letter-spacing: 1px; }
.n-shop small { font-size: 9pt; font-weight: 400; letter-spacing: 0; margin-left: 3mm; }
.n-meta { text-align: right; font-size: 9pt; line-height: 1.45; }
.n-meta b { font-size: 10pt; }
.n-line { display: flex; gap: 6mm; font-size: 9pt; padding-top: 1.4mm; }
.n-line .grow { flex: 1; }
.n-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 1.2mm; }
.n-table th { border-top: 0.3mm solid #000; border-bottom: 0.3mm solid #000; padding: 1mm 1mm; text-align: left; font-weight: 600; }
.n-table td { padding: 0 1mm; height: 6.2mm; border-bottom: 0.2mm dotted #999; vertical-align: middle; }
.n-table .r { text-align: right; }
.n-table tbody tr.filler td { border-bottom: 0.2mm dotted #ddd; }
.n-total { display: flex; justify-content: space-between; align-items: flex-end; border-top: 0.5mm solid #000; margin-top: 1mm; padding-top: 1mm; font-size: 9pt; }
.n-total .big { font-size: 13pt; font-weight: 800; }
.n-note { font-size: 9pt; padding-top: 1mm; }
.n-pay { display: flex; justify-content: flex-end; gap: 5mm; font-size: 9pt; padding-top: 1.2mm; }
.n-sign { display: flex; gap: 8mm; font-size: 9pt; margin-top: auto; padding-top: 1.4mm; }
.n-foot { display: flex; justify-content: space-between; align-items: center; font-size: 8pt; border-top: 0.2mm solid #ccc; margin-top: 1mm; padding-top: 0.8mm; }
.n-re { font-weight: 800; letter-spacing: 2px; font-size: 9pt; }
.grow-fill { flex: 1; }
`

const FULL_CSS_OVERRIDE = `
@page { size: 241mm 280mm; margin: 0; }
.sheet { height: 280mm; }
`

function salesNotePages(note: SalesNote, options: SalesPrintOptions): string {
  const perPage = options.paper === 'full' ? 28 : 12
  const isCounter = note.doc_type === 'counter_sale'
  const items = note.items
  const chunks: SalesNoteItem[][] = []
  for (let i = 0; i < Math.max(items.length, 1); i += perPage) {
    chunks.push(items.slice(i, i + perPage))
  }
  const pages = chunks.length || 1

  return chunks.map((chunk, index) => {
    const isLast = index === pages - 1
    const rows = chunk.map((item, i) => `
      <tr>
        <td>${index * perPage + i + 1}. ${escapeHtml(item.spu_name)}${item.sku_spec ? `（${escapeHtml(item.sku_spec)}）` : ''}</td>
        <td class="r">${formatQty(item.quantity)}</td>
        <td class="r">${escapeHtml(item.unit)}</td>
        <td class="r">${formatMoney(item.unit_price)}</td>
        <td class="r">${formatMoney(item.amount)}</td>
      </tr>`).join('')
    const fillers = Array.from({ length: Math.max(0, perPage - chunk.length) })
      .map(() => '<tr class="filler"><td colspan="5"></td></tr>').join('')

    const delivery = isCounter ? '' : `
      <div class="n-line">
        <span><b>送货</b> ${escapeHtml(note.delivery_place || '—')}</span>
        <span class="grow">${escapeHtml(note.delivery_address || '')}</span>
      </div>`

    const settle = isCounter
      ? `<div class="n-pay">
          <span>抹零 ${formatMoney(note.discount_amount)}</span>
          <span>实收 ${formatMoney(note.paid_amount)}</span>
          <span>找零 ${formatMoney(note.change_amount)}</span>
          <span>收款方式 ${payMethodText(note)}</span>
        </div><div class="grow-fill"></div>`
      : `<div class="n-sign"><span>客户签字：____________</span><span>送货人：__________</span><span>日期：____月____日</span></div>`

    const totalBlock = isLast ? `
      <div class="n-total">
        <div>合计（大写） <b>${rmbUpper(note.amount_due)}</b>${
          Number(note.coupon_amount) > 0
            ? `　商品金额 ¥${formatMoney(note.total_amount)}　优惠券抵扣${note.coupon_name ? `（${escapeHtml(note.coupon_name)}）` : ''} −${formatMoney(note.coupon_amount ?? 0)}`
            : ''
        }${
          Number(note.freight_deduction) > 0 ? `　运费抵扣 −${formatMoney(note.freight_deduction)}` : ''
        }${Number(note.discount_amount) > 0 && !isCounter ? `　抹零 −${formatMoney(note.discount_amount)}` : ''}${
          note.freight_mode === 'customer_paid' ? '　运费到付' : ''
        }</div>
        <div class="big">应收 ¥${formatMoney(note.amount_due)}</div>
      </div>
      ${note.remark ? `<div class="n-note">备注：${escapeHtml(note.remark)}</div>` : ''}
      ${settle}` : '<div class="grow-fill"></div>'

    return `<div class="sheet">
      <div class="n-head">
        <div class="n-shop">${escapeHtml(options.shopName || '')}<small>${escapeHtml(options.shopPhone || '')}</small></div>
        <div class="n-meta">单号 <b>${escapeHtml(note.order_no)}</b><br>${escapeHtml(options.printedAt)} 打印</div>
      </div>
      <div class="n-line">
        <span><b>客户</b> ${escapeHtml(note.customer_name || '—')}</span>
        <span><b>电话</b> ${escapeHtml(note.customer_phone || '—')}</span>
        <span class="grow"></span>
        <span><b>${isCounter ? '收款人' : '业务员'}</b> ${escapeHtml(note.sales_name || '—')}</span>
      </div>
      ${delivery}
      <table class="n-table">
        <thead><tr>
          <th>品名（规格）</th>
          <th class="r" style="width:16mm">数量</th>
          <th class="r" style="width:12mm">单位</th>
          <th class="r" style="width:22mm">单价</th>
          <th class="r" style="width:26mm">金额</th>
        </tr></thead>
        <tbody>${rows}${fillers}</tbody>
      </table>
      ${totalBlock}
      <div class="n-foot">
        <span>第 ${index + 1} / ${pages} 页 · ${LABEL[note.source] || ''}${isCounter ? '' : ' · 客户联 / 存根联（复写）'}</span>
        <span class="n-re">${note.is_reprint ? '补打' : ''}</span>
      </div>
    </div>`
  }).join('')
}

export function renderSalesNotes(notes: SalesNote[], options: SalesPrintOptions): string {
  const body = notes.map(note => salesNotePages(note, options)).join('')
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>销售单</title>
<style>${SALES_CSS}${options.paper === 'full' ? FULL_CSS_OVERRIDE : ''}</style>
</head><body>${body}</body></html>`
}

// ---------- 捡货单（A4） ----------

const PICKING_CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; color: #111; }
.sheet { width: 210mm; height: 297mm; padding: 12mm; display: flex; flex-direction: column; overflow: hidden; page-break-after: always; break-after: page; }
.sheet:last-child { page-break-after: auto; break-after: auto; }
.a4-head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 0.5mm solid #111; padding-bottom: 2.5mm; }
.a4-title { font-size: 16pt; font-weight: 800; letter-spacing: 4px; }
.a4-scope { font-size: 9.5pt; text-align: right; line-height: 1.6; }
.a4-scope b { font-size: 10.5pt; }
.a4-meta { display: flex; justify-content: space-between; font-size: 8.5pt; color: #444; padding: 2mm 0 2.5mm; }
.a4-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
.a4-table th { border-top: 0.4mm solid #111; border-bottom: 0.4mm solid #111; padding: 1.4mm 1.4mm; text-align: left; font-weight: 600; font-size: 9pt; }
.a4-table td { padding: 1.6mm 1.4mm; border-bottom: 0.2mm solid #ddd; vertical-align: top; }
.a4-table .c { text-align: center; }
.a4-table .spu { font-weight: 700; }
.a4-table .total { font-weight: 800; }
.a4-remarks { font-size: 8.5pt; margin-top: 6mm; }
.a4-remarks .rule { border-bottom: 0.2mm solid #bbb; height: 7mm; }
.a4-foot { margin-top: auto; border-top: 0.2mm solid #999; padding-top: 2mm; display: flex; justify-content: space-between; font-size: 9pt; }
`

const PICKING_PER_PAGE = 30

function pickingRows(items: PickingItem[]): { html: string; count: number }[] {
  const pages: { html: string; count: number }[] = []
  let index = 0
  while (index < items.length) {
    const slice = items.slice(index, index + PICKING_PER_PAGE)
    let html = ''
    let cursor = 0
    while (cursor < slice.length) {
      let end = cursor
      while (end < slice.length && slice[end].spu_name === slice[cursor].spu_name) end += 1
      for (let i = cursor; i < end; i += 1) {
        const row = slice[i]
        const plus = `${row.segments.map(seg => formatQty(seg.quantity)).join('+')} ${escapeHtml(row.unit)}`
        html += `<tr>
          <td class="c">${index + i + 1}</td>
          ${i === cursor ? `<td rowspan="${end - cursor}" class="spu">${escapeHtml(row.spu_name)}</td>` : ''}
          <td>${escapeHtml(row.sku_spec)}</td>
          <td>${escapeHtml(row.unit)}</td>
          <td>${plus}</td>
          <td class="total">${formatQty(row.total_quantity)} ${escapeHtml(row.unit)}</td>
          <td class="c">□</td>
        </tr>`
      }
      cursor = end
    }
    pages.push({ html, count: slice.length })
    index += PICKING_PER_PAGE
  }
  return pages
}

export function renderPickingSheet(result: PickingResult, options: PickingPrintOptions): string {
  const pages = pickingRows(result.items)
  if (!pages.length) {
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>${PICKING_CSS}</style></head>
<body><div class="sheet"><div class="a4-head"><div class="a4-title">捡货单</div>
<div class="a4-scope"><b>${escapeHtml(options.scopeLabel)}</b><br>${escapeHtml(options.printedAt)}</div></div>
<div class="a4-meta"><span>该范围没有需要配送的订单</span><span></span></div></div></body></html>`
  }
  const totalPages = pages.length
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>捡货单</title><style>${PICKING_CSS}</style></head>
<body>${pages.map((page, index) => `
  <div class="sheet">
    <div class="a4-head">
      <div class="a4-title">捡货单</div>
      <div class="a4-scope"><b>${escapeHtml(options.scopeLabel)}</b><br>打印 ${escapeHtml(options.printedAt)}${
        options.operatorName ? ` · ${escapeHtml(options.operatorName)}` : ''
      }</div>
    </div>
    <div class="a4-meta">
      <span>订单 ${result.summary.order_count} 单 · SKU ${result.summary.sku_count} 行 · 商品 ${result.summary.spu_count} 个</span>
      <span>只备货配送订单：现场提货、门店零售不在内</span>
    </div>
    <table class="a4-table">
      <thead><tr>
        <th style="width:10mm" class="c">序号</th>
        <th style="width:50mm">商品</th>
        <th style="width:26mm">规格</th>
        <th style="width:12mm">单位</th>
        <th>各订单数量（按配送顺序）</th>
        <th style="width:24mm">合计</th>
        <th style="width:10mm" class="c">勾</th>
      </tr></thead>
      <tbody>${page.html}</tbody>
    </table>
    ${index === totalPages - 1 ? `
    <div class="a4-remarks"><b>缺货 / 备注</b><div class="rule"></div><div class="rule"></div><div class="rule"></div></div>` : ''}
    <div class="a4-foot">
      <span>第 ${index + 1} / ${totalPages} 页 · 共 ${result.summary.sku_count} 个 SKU · ${result.summary.order_count} 单</span>
      <span>拣货人 ________　复核人 ________</span>
    </div>
  </div>`).join('')}</body></html>`
}
