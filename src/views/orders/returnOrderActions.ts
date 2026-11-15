import { returnApi } from '@/api'
import type { ReturnOrder, ReturnTerms } from '@/types'
import { returnDispositionLabels, returnRefundLabels } from '@/utils/dict'

export function returnTermsPayload(terms: ReturnTerms): ReturnTerms {
  const needsCost = terms.return_freight_mode === 'deduct' || terms.return_freight_mode === 'store_paid'
  return { ...terms, freight_cost: needsCost ? terms.freight_cost?.trim() ?? '' : null }
}

export function validReturnFreight(terms: ReturnTerms) {
  return terms.freight_cost === null || /^\d+(\.\d{1,2})?$/.test(terms.freight_cost)
}

export async function printReturnOrder(order: ReturnOrder, page: Window) {
  try {
    await returnApi.recordPrint(order.id)
    const doc = page.document
    doc.title = order.return_no
    const heading = doc.createElement('h1')
    heading.textContent = '味都美 · 退货单'
    doc.body.append(heading)
    const lines = [
      `退货单号：${order.return_no}`, `原订单号：${order.order_no}`, `客户：${order.customer_name}`,
      `退货原因：${order.reason}`,
      ...order.items.map(item => `${item.spu_name} ${item.sku_spec} · ${item.quantity} ${item.unit} · ${returnDispositionLabels[item.disposition]} · ¥${item.amount}`),
      `退货商品金额：¥${order.goods_amount}`, `运费补偿：¥${order.freight_compensation_amount}`,
      `冲原订单：¥${order.original_offset_amount}`,
      `${returnRefundLabels[order.refund_method]}：¥${order.refund_method === 'credit' ? order.credit_amount : order.refund_amount}`,
    ]
    for (const line of lines) {
      const p = doc.createElement('p')
      p.textContent = line
      doc.body.append(p)
    }
    page.focus()
    page.print()
  } catch (error) {
    page.close()
    throw error
  }
}
