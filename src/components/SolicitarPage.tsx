import { useState, useEffect, useMemo, useRef } from 'react'
import { useDarkMode } from '../hooks/useDarkMode'
import type { ItemDict } from '../types'
import QRCode from 'qrcode'

// ── Gerador de payload PIX (EMV) ───────────────────────────────
function crc16(str: string): string {
  let crc = 0xFFFF
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')
}

function tlv(id: string, value: string): string {
  return id + value.length.toString().padStart(2, '0') + value
}

function pixPayload(key: string, name: string, city: string, amount: number): string {
  const gui     = tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', key)
  const body    = [
    tlv('00', '01'),
    '010212',
    tlv('26', gui),
    tlv('52', '0000'),
    tlv('53', '986'),
    tlv('54', amount.toFixed(2)),
    tlv('58', 'BR'),
    tlv('59', name.slice(0, 25)),
    tlv('60', city.slice(0, 15)),
    tlv('62', tlv('05', '***')),
    '6304',
  ].join('')
  return body + crc16(body)
}

// ── Tipos ──────────────────────────────────────────────────────
interface FormData {
  nome:         string
  contato:      string
  endereco:     string
  data_entrega: string
  obs:          string
}

interface NFData {
  razaoSocial: string
  cpfCnpj:     string
  email:        string
  endereco:     string
  municipio:    string
  uf:           string
}

type Step    = 1 | 2 | 3
type Sucesso = null | 'whatsapp' | 'pix'

const COMPANY_PHONE = '5518780137776'
const PIX_KEY       = '18780137776'
const today         = new Date().toISOString().split('T')[0]

const UF_LIST = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

function emptyForm(): FormData {
  return { nome: '', contato: '', endereco: '', data_entrega: '', obs: '' }
}

function emptyNF(form: FormData): NFData {
  return { razaoSocial: form.nome, cpfCnpj: '', email: '', endereco: form.endereco, municipio: '', uf: 'SP' }
}

function maskCep(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

function maskCpfCnpj(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 11) {
    // CPF
    if (d.length <= 3) return d
    if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
    if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
  }
  // CNPJ
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2)  return d.length ? `(${d}` : ''
  if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

function fmtDate(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}


// ── Componente principal ───────────────────────────────────────
export function SolicitarPage() {
  const { dark, toggle } = useDarkMode(true)

  // Catálogo
  const [itemKeys,   setItemKeys]   = useState<string[]>([])
  const [precoMap,   setPrecoMap]   = useState<Record<string, number>>({})
  const [catLoad,    setCatLoad]    = useState<'loading' | 'ok' | 'error'>('loading')
  const [busca,      setBusca]      = useState('')
  const [categoria,  setCategoria]  = useState('Todos')

  // Pedido
  const [itens,  setItens]  = useState<ItemDict>(() => {
    try { return JSON.parse(sessionStorage.getItem('hf_itens') || '{}') } catch { return {} }
  })
  const [form,   setForm]   = useState<FormData>(() => {
    try { return JSON.parse(sessionStorage.getItem('hf_form') || 'null') || emptyForm() } catch { return emptyForm() }
  })

  // Nota Fiscal
  const [querNF, setQuerNF] = useState(false)
  const [nf,     setNF]     = useState<NFData>(emptyNF(emptyForm()))
  const [nfErrors, setNFErrors] = useState<Partial<NFData>>({})

  // Navegação
  const [step,    setStep]    = useState<Step>(1)
  const [errors,  setErrors]  = useState<Partial<FormData>>({})

  // CEP + campos de endereço separados
  const [cep,        setCep]        = useState('')
  const [cepStatus,  setCepStatus]  = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [logradouro, setLogradouro] = useState('')
  const [numero,     setNumero]     = useState('')
  const [bairro,     setBairro]     = useState('')
  const [cidade,     setCidade]     = useState('')
  const [ufEvento,   setUfEvento]   = useState('')
  const [nfCep,      setNfCep]      = useState('')
  const [nfCepStatus,setNfCepStatus]= useState<'idle' | 'loading' | 'ok' | 'error'>('idle')

  // Fluxo PIX
  const [pixLoading,    setPixLoading]    = useState(false)
  const [orderId,       setOrderId]       = useState<number | null>(() => {
    try { const v = sessionStorage.getItem('hf_order_id'); return v ? Number(v) : null } catch { return null }
  })
  const [orderTotal,    setOrderTotal]    = useState<number>(() => {
    try { return Number(sessionStorage.getItem('hf_order_total') || '0') } catch { return 0 }
  })
  const [pixConfirmado, setPixConfirmado] = useState(() => {
    try { return sessionStorage.getItem('hf_pix_confirmado') === '1' } catch { return false }
  })
  const [pixCopiado,        setPixCopiado]        = useState(false)
  const [qrDataUrl,         setQrDataUrl]         = useState<string>('')
  const [qrError,           setQrError]           = useState(false)
  const [pagamentoRecebido, setPagamentoRecebido] = useState(() => {
    try { return sessionStorage.getItem('hf_pago') === '1' } catch { return false }
  })

  // Sucesso
  const [sucesso, setSucesso] = useState<Sucesso>(() => {
    try { return (sessionStorage.getItem('hf_sucesso') as Sucesso) || null } catch { return null }
  })
  const [apiError, setApiError] = useState('')
  const [loading,  setLoading]  = useState(false)

  // ── Busca CEP ────────────────────────────────────────────────
  function composeEndereco(log: string, num: string, bai: string, cid: string, uf: string) {
    const parts = [log, num ? `nº ${num}` : '', bai, cid && uf ? `${cid} - ${uf}` : cid || uf].filter(Boolean)
    return parts.join(', ')
  }

  async function buscarCep(rawCep: string) {
    const digits = rawCep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setCepStatus('loading')
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: ctrl.signal })
      const data = await res.json()
      if (data.erro) { setCepStatus('error'); return }
      setLogradouro(data.logradouro || '')
      setBairro(data.bairro || '')
      setCidade(data.localidade || '')
      setUfEvento(data.uf || '')
      setNumero('')
      setForm(f => ({ ...f, endereco: composeEndereco(data.logradouro || '', '', data.bairro || '', data.localidade || '', data.uf || '') }))
      setCepStatus('ok')
    } catch {
      setCepStatus('error')
    } finally {
      clearTimeout(timer)
    }
  }

  async function buscarNfCep(rawCep: string) {
    const digits = rawCep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setNfCepStatus('loading')
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: ctrl.signal })
      const data = await res.json()
      if (data.erro) { setNfCepStatus('error'); return }
      const endereco = [data.logradouro, data.bairro].filter(Boolean).join(', ')
      setNF(n => ({
        ...n,
        endereco:  endereco || n.endereco,
        municipio: data.localidade || n.municipio,
        uf:        data.uf || n.uf,
      }))
      setNfCepStatus('ok')
    } catch {
      setNfCepStatus('error')
    } finally {
      clearTimeout(timer)
    }
  }

  // ── Carregar catálogo ────────────────────────────────────────
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function loadCatalog(attempt = 0) {
    setCatLoad('loading')
    fetch('/api/precos')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then((d: Record<string, number>) => {
        setItemKeys(Object.keys(d).sort((a, b) => a.localeCompare(b, 'pt-BR')))
        setPrecoMap(d)
        setCatLoad('ok')
      })
      .catch(() => {
        // tenta automaticamente até 3 vezes com 2s de intervalo
        if (attempt < 3) {
          retryRef.current = setTimeout(() => loadCatalog(attempt + 1), 2000)
        } else {
          setCatLoad('error')
        }
      })
  }

  useEffect(() => {
    loadCatalog()
    return () => { if (retryRef.current) clearTimeout(retryRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Gerar QR code PIX quando confirmado
  useEffect(() => {
    if (!pixConfirmado || !orderTotal) return
    const payload = pixPayload(PIX_KEY, 'Hercules Festas', 'Sao Paulo', orderTotal / 2)
    QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 2, width: 220 })
      .then(url => { setQrDataUrl(url); setQrError(false) })
      .catch(() => setQrError(true))
  }, [pixConfirmado, orderTotal])

  // Polling: verifica confirmação do pedido e pagamento (máx 30 min)
  useEffect(() => {
    if (sucesso !== 'pix' || !orderId || pagamentoRecebido) return
    let attempts = 0
    const MAX_ATTEMPTS = 360 // 360 × 5s = 30 min
    const check = async () => {
      if (attempts >= MAX_ATTEMPTS) { clearInterval(interval); return }
      attempts++
      try {
        const res  = await fetch(`/api/alugueis/${orderId}`)
        if (!res.ok) return
        const data = await res.json()
        // Detecta pagamento confirmado (pago = 1)
        if (data.pago === 1) {
          clearInterval(interval)
          sessionStorage.setItem('hf_pago', '1')
          setPagamentoRecebido(true)
          setPixConfirmado(true)
          return
        }
        // Detecta confirmação do pedido pelo admin
        if (!pixConfirmado && data.status === 'confirmado') {
          sessionStorage.setItem('hf_pix_confirmado', '1')
          if (data.total) {
            sessionStorage.setItem('hf_order_total', String(data.total))
            setOrderTotal(data.total)
          }
          setPixConfirmado(true)
        }
      } catch { /* ignora falha de rede pontual */ }
    }
    check()
    const interval = setInterval(check, 5000)
    return () => clearInterval(interval)
  }, [sucesso, pixConfirmado, orderId, pagamentoRecebido])

  // Persistir rascunho no sessionStorage
  useEffect(() => {
    if (!sucesso) {
      try {
        sessionStorage.setItem('hf_itens', JSON.stringify(itens))
        sessionStorage.setItem('hf_form',  JSON.stringify(form))
      } catch { /* ignore */ }
    }
  }, [itens, form, sucesso])

  // ── Categorias ───────────────────────────────────────────────
  function getCategoria(nome: string): string {
    const n = nome.toLowerCase()
    if (/inflá|pula|air.?game|tobogã|castle|bounc/.test(n))   return 'Infláveis'
    if (/tenda|cobertura|toldo|gazebo/.test(n))                return 'Tendas'
    if (/piscina|bolinhas|playground|escorrega/.test(n))       return 'Brinquedos'
    if (/mesa|cadeira|banco|banqueta|tablado|móv/.test(n))     return 'Mobiliário'
    return 'Outros'
  }

  function getEmoji(nome: string): string {
    const cat = getCategoria(nome)
    if (cat === 'Infláveis')  return '🎪'
    if (cat === 'Tendas')     return '⛺'
    if (cat === 'Brinquedos') return '🎡'
    if (cat === 'Mobiliário') return '🪑'
    return '🎉'
  }

  function getGradient(nome: string): string {
    const cat = getCategoria(nome)
    if (cat === 'Infláveis')  return 'from-blue-500/20 to-blue-900/40'
    if (cat === 'Tendas')     return 'from-amber-500/20 to-amber-900/40'
    if (cat === 'Brinquedos') return 'from-pink-500/20 to-pink-900/40'
    if (cat === 'Mobiliário') return 'from-teal-500/20 to-teal-900/40'
    return 'from-purple-500/20 to-purple-900/40'
  }

  const categorias = useMemo(() => {
    const cats = new Set(itemKeys.map(getCategoria))
    return ['Todos', ...Array.from(cats).sort()]
  }, [itemKeys])

  // ── Itens ────────────────────────────────────────────────────
  const totalItens = useMemo(() =>
    Object.values(itens).reduce((s, q) => s + q, 0), [itens])

  const filteredItems = useMemo(() => {
    let list = itemKeys
    if (busca)            list = list.filter(k => k.toLowerCase().includes(busca.toLowerCase()))
    if (categoria !== 'Todos') list = list.filter(k => getCategoria(k) === categoria)
    return list
  }, [itemKeys, busca, categoria])

  function setQty(item: string, delta: number) {
    setItens(prev => {
      const cur = (prev[item] || 0) + delta
      if (cur <= 0) {
        const next = { ...prev }
        delete next[item]
        return next
      }
      return { ...prev, [item]: cur }
    })
  }

  // ── Validação step 2 ─────────────────────────────────────────
  function validateForm(): boolean {
    const e: Partial<FormData> = {}
    if (!form.nome.trim())         e.nome = 'Informe seu nome.'
    if (!form.contato.trim())      e.contato = 'Informe o telefone.'
    if (!form.data_entrega)        e.data_entrega = 'Informe a data.'
    if (form.data_entrega < today) e.data_entrega = 'Data não pode ser no passado.'
    setErrors(e)

    if (querNF) {
      const ne: Partial<NFData> = {}
      if (!nf.razaoSocial.trim()) ne.razaoSocial = 'Informe o nome/razão social.'
      const digits = nf.cpfCnpj.replace(/\D/g, '')
      if (!digits || (digits.length !== 11 && digits.length !== 14)) ne.cpfCnpj = 'CPF (11 dígitos) ou CNPJ (14 dígitos) inválido.'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(nf.email.trim())) ne.email = 'Informe um e-mail válido.'
      if (!nf.municipio.trim()) ne.municipio = 'Informe o município.'
      setNFErrors(ne)
      if (Object.keys(ne).length > 0) return false
    }

    return Object.keys(e).length === 0
  }

  function goStep(n: Step) {
    if (n === 2 && totalItens === 0) return
    if (n === 3 && !validateForm()) return
    setStep(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Submeter pedido ──────────────────────────────────────────
  async function submitOrder(status: string): Promise<{ id: number; total: number }> {
    let obsTexto = form.obs.trim()
    if (querNF) {
      const nfTexto = [
        '\n--- NOTA FISCAL SOLICITADA ---',
        `Razão Social: ${nf.razaoSocial.trim()}`,
        `CPF/CNPJ: ${nf.cpfCnpj.trim()}`,
        `E-mail: ${nf.email.trim()}`,
        `Endereço: ${nf.endereco.trim()}`,
        `Município/UF: ${nf.municipio.trim()}/${nf.uf}`,
      ].join('\n')
      obsTexto = obsTexto ? `${obsTexto}${nfTexto}` : nfTexto.replace('\n', '')
    }

    const res = await fetch('/api/alugueis', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        nome:         form.nome.trim(),
        contato:      form.contato.trim(),
        endereco:     form.endereco.trim(),
        data_entrega: form.data_entrega,
        frete:        0,
        pago:         false,
        itens,
        obs:          obsTexto,
        status,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error((data as { erro?: string }).erro || `Erro ${res.status}`)
    return data as { id: number; total: number }
  }

  // ── Opção WhatsApp ────────────────────────────────────────────
  async function handleWhatsapp() {
    setLoading(true)
    setApiError('')
    try {
      const { id } = await submitOrder('em_negociacao')
      const itensTexto = Object.entries(itens)
        .map(([item, qty]) => `  • ${item} × ${qty}`)
        .join('\n')
      const msg = encodeURIComponent(
`Olá! Quero solicitar um orçamento para minha festa. 🎉

📋 *Pedido #${String(id).padStart(4, '0')}*

👤 *Nome:* ${form.nome.trim()}
📅 *Data do evento:* ${fmtDate(form.data_entrega)}${form.endereco ? `\n📍 *Endereço:* ${form.endereco.trim()}` : ''}

📦 *Itens de interesse:*
${itensTexto}${form.obs ? `\n\n💬 *Obs:* ${form.obs.trim()}` : ''}`
      )
      window.open(`https://wa.me/${COMPANY_PHONE}?text=${msg}`, '_blank')
      sessionStorage.setItem('hf_sucesso', 'whatsapp')
      sessionStorage.setItem('hf_form',   JSON.stringify(form))
      sessionStorage.setItem('hf_itens',  JSON.stringify(itens))
      setSucesso('whatsapp')
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Erro ao enviar pedido.')
    } finally {
      setLoading(false)
    }
  }

  // ── Opção PIX ────────────────────────────────────────────────
  async function handlePix() {
    setPixLoading(true)
    setApiError('')
    try {
      const { id, total } = await submitOrder('aguardando_pagamento')
      sessionStorage.setItem('hf_sucesso',    'pix')
      sessionStorage.setItem('hf_form',       JSON.stringify(form))
      sessionStorage.setItem('hf_itens',      JSON.stringify(itens))
      sessionStorage.setItem('hf_order_id',   String(id))
      sessionStorage.setItem('hf_order_total', String(total))
      setOrderId(id)
      setOrderTotal(total)
      setSucesso('pix')
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Erro ao registrar pedido.')
    } finally {
      setPixLoading(false)
    }
  }

  // ── Telas de sucesso ─────────────────────────────────────────
  if (sucesso) {
    const isWa = sucesso === 'whatsapp'
    return (
      <div className="min-h-screen bg-bg flex flex-col">
        <PageHeader dark={dark} onToggle={toggle} />
        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6
              ${isWa ? 'bg-green-400/10 border border-green-400/25' : 'bg-teal-400/10 border border-teal-400/25'}`}>
              {isWa ? (
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-green-400">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              ) : (
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-teal-400">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <h1 className="font-sans text-2xl font-bold text-ink mb-3">
              {isWa ? 'Mensagem enviada!' : pagamentoRecebido ? 'Reserva garantida!' : 'Pedido recebido!'}
            </h1>
            <p className="font-sans text-[0.9rem] text-ink2 leading-relaxed mb-6">
              {isWa
                ? 'Sua solicitação foi registrada e a mensagem abriu no WhatsApp. Nossa equipe responderá em breve com o orçamento.'
                : pagamentoRecebido
                  ? 'Seu pagamento foi confirmado e sua data está reservada. Entraremos em contato para combinar os detalhes da entrega.'
                  : 'Recebemos seu pedido. Nossa equipe analisará a disponibilidade e você receberá uma mensagem no WhatsApp com a confirmação e os dados para pagamento.'}
            </p>

            {sucesso === 'pix' && !pixConfirmado && (
              <div className="bg-orange-400/[0.06] border border-orange-400/25 rounded-lg p-4 text-left mb-4">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    <svg className="animate-spin w-[18px] h-[18px] text-orange-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-sans text-[0.82rem] font-semibold text-orange-400 mb-1">
                      Aguardando confirmação da equipe...
                    </p>
                    <p className="font-sans text-[0.78rem] text-ink2 leading-relaxed">
                      Estamos verificando a disponibilidade. Assim que confirmarmos, os dados de pagamento PIX aparecerão aqui automaticamente.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {sucesso === 'pix' && pagamentoRecebido && (
              <div className="bg-green-400/[0.06] border border-green-400/30 rounded-lg p-5 text-left mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-green-400/15 border border-green-400/30
                                  flex items-center justify-center shrink-0">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-green-400">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="font-mono text-[0.7rem] font-bold text-green-400 uppercase tracking-[0.08em]">
                    Pagamento confirmado!
                  </p>
                </div>
                <p className="font-sans text-[0.85rem] text-ink leading-relaxed mb-3">
                  Recebemos a confirmação do seu pagamento. Sua reserva está garantida! 🎉
                </p>
                <div className="space-y-2 text-[0.8rem] text-ink2">
                  <div className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>Nossa equipe entrará em contato para confirmar os detalhes da entrega.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>O restante (50%) será cobrado na entrega dos equipamentos.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>Qualquer dúvida, nos chame no WhatsApp.</span>
                  </div>
                </div>
              </div>
            )}

            {sucesso === 'pix' && pixConfirmado && !pagamentoRecebido && (
              <div className="bg-teal-400/[0.06] border border-teal-400/30 rounded-lg p-5 text-left mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-teal-400">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="font-mono text-[0.7rem] font-bold text-teal-400 uppercase tracking-[0.08em]">
                    Pedido confirmado — faça o pagamento de 50%
                  </p>
                </div>
                {/* QR Code */}
                {qrDataUrl && (
                  <div className="flex justify-center mb-4">
                    <div className="bg-white p-3 rounded-lg inline-block">
                      <img src={qrDataUrl} alt="QR Code PIX" width={200} height={200} />
                    </div>
                  </div>
                )}
                {qrError && (
                  <p className="text-center font-mono text-[0.7rem] text-red-400 mb-3">
                    Não foi possível gerar o QR Code. Use o código Pix abaixo.
                  </p>
                )}

                <div className="bg-bg border border-[var(--c-border)] rounded-lg p-4 mb-3">
                  <p className="font-mono text-[0.6rem] text-ink3 uppercase tracking-[0.08em] mb-1">Pix Copia e Cola / Chave</p>
                  <div className="flex items-center gap-3">
                    <p className="font-mono text-[1rem] font-bold text-ink tracking-wider">{PIX_KEY}</p>
                    <button
                      type="button"
                      onClick={() => {
                        const payload = pixPayload(PIX_KEY, 'Hercules Festas', 'Sao Paulo', orderTotal / 2)
                        navigator.clipboard.writeText(payload).then(() => {
                          setPixCopiado(true)
                          setTimeout(() => setPixCopiado(false), 2000)
                        })
                      }}
                      className="px-3 py-1 rounded-sm border border-teal-400/30 text-teal-400
                                 font-mono text-[0.65rem] cursor-pointer hover:bg-teal-400/10 transition-all shrink-0">
                      {pixCopiado ? '✓ Copiado' : 'Copiar código'}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[0.6rem] text-ink3 uppercase tracking-[0.08em]">Valor da entrada (50%)</p>
                    <p className="font-sans text-[1.3rem] font-bold text-teal-400">
                      R$ {(orderTotal / 2).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[0.6rem] text-ink3 uppercase tracking-[0.08em]">Restante na entrega</p>
                    <p className="font-sans text-[0.9rem] font-semibold text-ink2">
                      R$ {(orderTotal / 2).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                <p className="font-sans text-[0.72rem] text-ink3 mt-3 leading-relaxed">
                  Após realizar o pagamento, envie o comprovante pelo WhatsApp para confirmar sua reserva. 🎉
                </p>
              </div>
            )}

            <div className="bg-bg2 border border-[var(--c-border)] rounded-lg p-4 text-left mb-6">
              <p className="font-mono text-[0.62rem] text-ink3 uppercase tracking-[0.08em] mb-3">Resumo</p>
              <p className="font-sans text-[0.85rem] text-ink2 mb-1">
                <span className="text-ink3">Nome: </span>{form.nome}
              </p>
              <p className="font-sans text-[0.85rem] text-ink2 mb-3">
                <span className="text-ink3">Data: </span>{fmtDate(form.data_entrega)}
              </p>
              <div className="border-t border-[var(--c-border)] pt-3 space-y-1">
                {Object.entries(itens).map(([item, qty]) => (
                  <p key={item} className="font-sans text-[0.82rem] text-ink2">
                    {item} <span className="text-ink3">× {qty}</span>
                  </p>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                ;['hf_sucesso','hf_form','hf_itens','hf_order_id','hf_order_total','hf_pix_confirmado','hf_pago']
                  .forEach(k => sessionStorage.removeItem(k))
                setSucesso(null)
                setPixConfirmado(false)
                setPagamentoRecebido(false)
                setOrderId(null)
                setOrderTotal(0)
                setItens({})
                setForm(emptyForm())
                setStep(1)
              }}
              className="mt-6 px-5 py-2.5 border border-[var(--c-border)] rounded-sm
                         font-mono text-[0.75rem] text-ink2 cursor-pointer
                         hover:border-[var(--c-border2)] hover:text-ink transition-all"
            >
              Fazer novo pedido
            </button>
            <p className="font-mono text-[0.65rem] text-ink3 tracking-[0.04em] mt-4">
              Hércules Festas — Aluguel de equipamentos para festas e eventos
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Layout principal ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg text-ink font-sans">
      <PageHeader dark={dark} onToggle={toggle} />

      {/* Barra de etapas */}
      <div className="border-b border-[var(--c-border)] bg-bg2">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-0">
            {[
              { n: 1, label: 'Itens' },
              { n: 2, label: 'Seus dados' },
              { n: 3, label: 'Finalizar' },
            ].map(({ n, label }, i) => {
              const done    = step > n
              const active  = step === n
              return (
                <div key={n} className="flex items-center">
                  {i > 0 && (
                    <div className={`h-px w-10 mx-2 transition-colors
                      ${done ? 'bg-accent' : 'bg-[var(--c-border)]'}`} />
                  )}
                  <button
                    type="button"
                    onClick={() => { if (done) setStep(n as Step) }}
                    className={`flex items-center gap-2 cursor-default transition-all
                      ${done ? 'cursor-pointer' : ''}`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center
                                      font-mono text-[0.65rem] font-bold transition-colors
                      ${active ? 'bg-accent text-white'
                        : done ? 'bg-accent/20 text-accent'
                        : 'bg-[var(--c-border)] text-ink3'}`}>
                      {done ? '✓' : n}
                    </span>
                    <span className={`font-sans text-[0.8rem] transition-colors
                      ${active ? 'text-ink font-semibold' : done ? 'text-accent' : 'text-ink3'}`}>
                      {label}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Grid principal */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-[1fr_300px] gap-6 items-start max-[900px]:grid-cols-1">

          {/* ── Conteúdo por etapa ── */}
          <div>

            {/* ETAPA 1 — Itens */}
            {step === 1 && (
              <div className="animate-fade-up">

                {/* Cabeçalho */}
                <div className="mb-5">
                  <p className="font-mono text-[0.62rem] text-accent uppercase tracking-[0.12em] mb-1">
                    Coleção disponível
                  </p>
                  <div className="flex items-end justify-between gap-4 flex-wrap">
                    <div>
                      <h1 className="font-sans text-2xl font-bold tracking-[-0.03em] text-ink">
                        Equipamentos para Festas
                      </h1>
                      <p className="font-sans text-[0.82rem] text-ink2 mt-1">
                        Selecione os itens e quantidades desejadas
                      </p>
                    </div>
                    {/* Busca */}
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3 w-3.5 h-3.5"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input type="text" placeholder="Buscar equipamento..."
                        value={busca} onChange={e => setBusca(e.target.value)}
                        className="pl-9 pr-3 py-2 bg-bg2 border border-[var(--c-border)] rounded
                                   font-sans text-[0.82rem] text-ink placeholder:text-ink3 w-52
                                   focus:outline-none focus:border-accent/40 focus:ring-[3px]
                                   focus:ring-accent/6 transition-all" />
                    </div>
                  </div>
                </div>

                {/* Filtros de categoria */}
                {catLoad === 'ok' && (
                  <div className="flex gap-2 mb-5 flex-wrap">
                    {categorias.map(cat => (
                      <button key={cat} type="button"
                        onClick={() => setCategoria(cat)}
                        className={`px-3 py-1.5 rounded-sm border font-mono text-[0.68rem]
                                    cursor-pointer transition-all whitespace-nowrap
                          ${categoria === cat
                            ? 'bg-accent text-white border-accent'
                            : 'bg-bg2 text-ink2 border-[var(--c-border)] hover:border-[var(--c-border2)] hover:text-ink'}`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                )}

                {catLoad === 'loading' && (
                  <div className="flex items-center justify-center py-20 gap-3">
                    <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                    <span className="font-mono text-[0.75rem] text-ink3 tracking-[0.05em]">
                      Carregando catálogo...
                    </span>
                  </div>
                )}

                {catLoad === 'error' && (
                  <div className="bg-bg2 border border-[var(--c-border)] rounded-lg p-8 text-center">
                    <p className="font-sans text-[0.85rem] text-ink2 mb-4">
                      Não foi possível carregar o catálogo.
                    </p>
                    <button type="button" onClick={() => loadCatalog()}
                      className="px-4 py-2 rounded-sm border border-[var(--c-border2)]
                                 font-mono text-[0.72rem] text-ink2 cursor-pointer
                                 hover:border-accent/40 hover:text-accent transition-all">
                      Tentar novamente
                    </button>
                  </div>
                )}

                {catLoad === 'ok' && (
                  <div className="grid grid-cols-3 gap-4 max-[800px]:grid-cols-2 max-[500px]:grid-cols-1">
                    {filteredItems.map(item => {
                      const qty   = itens[item] || 0
                      const preco = precoMap[item] || 0
                      const cat   = getCategoria(item)
                      return (
                        <div key={item}
                          className={`rounded-xl border overflow-hidden transition-all flex flex-col
                            ${qty > 0
                              ? 'border-accent/40 shadow-[0_0_16px_rgba(79,142,247,0.12)]'
                              : 'border-[var(--c-border)] hover:border-[var(--c-border2)]'}`}>

                          {/* Imagem placeholder */}
                          <div className={`relative h-36 bg-gradient-to-br ${getGradient(item)}
                                           flex items-center justify-center`}>
                            <span className="text-5xl select-none">{getEmoji(item)}</span>
                            {/* Badge */}
                            <div className="absolute top-2.5 left-2.5">
                              {qty > 0 ? (
                                <span className="px-2 py-0.5 rounded-sm bg-accent text-white
                                                 font-mono text-[0.6rem] font-bold tracking-[0.06em]">
                                  SELECIONADO ×{qty}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-sm bg-bg/70 backdrop-blur-sm
                                                 border border-[var(--c-border)] text-ink3
                                                 font-mono text-[0.6rem] tracking-[0.06em]">
                                  {cat.toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Conteúdo */}
                          <div className="p-4 bg-bg2 flex flex-col flex-1">
                            <p className="font-sans text-[0.88rem] font-semibold text-ink leading-snug mb-3">
                              {item}
                            </p>

                            {preco > 0 && (
                              <div className="mb-3">
                                <p className="font-mono text-[0.58rem] text-ink3 uppercase tracking-[0.08em]">
                                  Diária
                                </p>
                                <p className="font-sans text-[0.95rem] font-bold text-ink">
                                  R$ {preco.toLocaleString('pt-BR')}<span className="font-normal text-ink3 text-[0.72rem]">/dia</span>
                                </p>
                              </div>
                            )}

                            {/* Controles qty */}
                            <div className="flex items-center gap-2 mt-auto">
                              <button type="button" onClick={() => setQty(item, -1)} disabled={qty === 0}
                                className="w-8 h-8 rounded-sm border border-[var(--c-border)] bg-bg
                                           font-mono text-[1rem] text-ink3 flex items-center justify-center
                                           cursor-pointer hover:border-[var(--c-border2)] hover:text-ink
                                           disabled:opacity-25 disabled:cursor-not-allowed transition-all">
                                −
                              </button>
                              <span className="font-mono text-[0.9rem] font-semibold text-ink w-6 text-center">
                                {qty}
                              </span>
                              <button type="button" onClick={() => setQty(item, +1)}
                                className="w-8 h-8 rounded-sm border border-[var(--c-border)] bg-bg
                                           font-mono text-[1rem] text-ink3 flex items-center justify-center
                                           cursor-pointer hover:border-accent/50 hover:text-accent transition-all">
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {filteredItems.length === 0 && (
                      <div className="col-span-3 text-center py-16 text-ink3 font-mono text-[0.75rem]">
                        Nenhum item encontrado{busca ? ` para "${busca}"` : ''}.
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}

            {/* ETAPA 2 — Dados */}
            {step === 2 && (
              <div className="animate-fade-up">
                <div className="mb-6 pb-5 border-b border-[var(--c-border)]">
                  <h1 className="font-sans text-2xl font-bold tracking-[-0.03em] text-ink">
                    Seus dados
                  </h1>
                  <p className="font-mono text-[0.7rem] text-ink3 mt-1 tracking-[0.05em] uppercase">
                    Para entrarmos em contato com o orçamento
                  </p>
                </div>

                <div className="bg-bg2 border border-[var(--c-border)] rounded-lg p-6">
                  <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">

                    <Field label="Nome completo *" error={errors.nome}>
                      <input type="text" value={form.nome} placeholder="Seu nome completo"
                        onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                        className={inputCls(!!errors.nome)} />
                    </Field>

                    <Field label="Telefone / WhatsApp *" error={errors.contato}>
                      <input type="tel" value={form.contato} placeholder="(18) 99999-9999"
                        onChange={e => setForm(f => ({ ...f, contato: maskPhone(e.target.value) }))}
                        className={inputCls(!!errors.contato)} />
                    </Field>

                    <Field label="Data do evento *" error={errors.data_entrega} className="col-span-1">
                      <input type="date" value={form.data_entrega} min={today}
                        title="Data do evento" required
                        onChange={e => setForm(f => ({ ...f, data_entrega: e.target.value }))}
                        className={inputCls(!!errors.data_entrega)} />
                    </Field>

                    {/* CEP + separador visual */}
                    <Field label="CEP do evento" className="col-span-2 max-[600px]:col-span-1">
                      <div className="flex items-center gap-3">
                        <div className="relative w-40 shrink-0">
                          <input type="text" value={cep} placeholder="00000-000"
                            onChange={e => {
                              const v = maskCep(e.target.value)
                              setCep(v)
                              setCepStatus('idle')
                              if (v.replace(/\D/g, '').length === 8) buscarCep(v)
                            }}
                            className={inputCls(false)} />
                          {cepStatus === 'loading' && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2">
                              <svg className="animate-spin w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                              </svg>
                            </span>
                          )}
                          {cepStatus === 'ok'    && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 text-sm font-bold">✓</span>}
                          {cepStatus === 'error' && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 text-[0.68rem]">Inválido</span>}
                        </div>
                        {cepStatus === 'ok' && (
                          <p className="font-mono text-[0.68rem] text-green-400 leading-snug">
                            {[bairro, cidade, ufEvento].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                    </Field>

                    {/* Logradouro + Número */}
                    <Field label="Logradouro">
                      <input type="text" value={logradouro} placeholder="Rua / Avenida / Travessa..."
                        onChange={e => {
                          setLogradouro(e.target.value)
                          setForm(f => ({ ...f, endereco: composeEndereco(e.target.value, numero, bairro, cidade, ufEvento) }))
                        }}
                        className={inputCls(false)} />
                    </Field>

                    <Field label="Número">
                      <input type="text" value={numero} placeholder="Ex: 114"
                        onChange={e => {
                          setNumero(e.target.value)
                          setForm(f => ({ ...f, endereco: composeEndereco(logradouro, e.target.value, bairro, cidade, ufEvento) }))
                        }}
                        className={inputCls(false)} />
                    </Field>

                    {/* Bairro + Cidade + UF */}
                    <Field label="Bairro">
                      <input type="text" value={bairro} placeholder="Bairro"
                        onChange={e => {
                          setBairro(e.target.value)
                          setForm(f => ({ ...f, endereco: composeEndereco(logradouro, numero, e.target.value, cidade, ufEvento) }))
                        }}
                        className={inputCls(false)} />
                    </Field>

                    <Field label="Cidade">
                      <input type="text" value={cidade} placeholder="Cidade"
                        onChange={e => {
                          setCidade(e.target.value)
                          setForm(f => ({ ...f, endereco: composeEndereco(logradouro, numero, bairro, e.target.value, ufEvento) }))
                        }}
                        className={inputCls(false)} />
                    </Field>

                    <Field label="UF">
                      <select value={ufEvento} title="Estado (UF)"
                        onChange={e => {
                          setUfEvento(e.target.value)
                          setForm(f => ({ ...f, endereco: composeEndereco(logradouro, numero, bairro, cidade, e.target.value) }))
                        }}
                        className={inputCls(false)}>
                        <option value="">—</option>
                        {UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                      </select>
                    </Field>

                    <Field label="Observações / O que precisa" className="col-span-2 max-[600px]:col-span-1">
                      <textarea value={form.obs} rows={3}
                        placeholder="Descreva detalhes do evento, horário de entrega, montagem..."
                        onChange={e => setForm(f => ({ ...f, obs: e.target.value }))}
                        className={`${inputCls(false)} resize-none`} />
                    </Field>
                  </div>
                </div>

                {/* Toggle Nota Fiscal */}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !querNF
                      setQuerNF(next)
                      if (next) setNF(emptyNF(form))
                      setNFErrors({})
                    }}
                    className={`w-full flex items-center justify-between px-5 py-3.5 rounded-lg border
                                transition-all cursor-pointer
                      ${querNF
                        ? 'bg-accent/[0.06] border-accent/30 text-ink'
                        : 'bg-bg2 border-[var(--c-border)] text-ink2 hover:border-[var(--c-border2)]'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 transition-colors
                        ${querNF ? 'bg-accent/15 border border-accent/25' : 'bg-bg3 border border-[var(--c-border)]'}`}>
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          className={querNF ? 'text-accent' : 'text-ink3'}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className="font-sans text-[0.85rem] font-semibold leading-snug">
                          Solicitar Nota Fiscal (NFS-e)
                        </p>
                        <p className="font-mono text-[0.62rem] text-ink3 mt-0.5">
                          {querNF ? 'Preencha os dados abaixo para emissão' : 'Opcional — clique para adicionar dados fiscais'}
                        </p>
                      </div>
                    </div>
                    <div className={`w-10 h-5 rounded-full border transition-all relative shrink-0
                      ${querNF ? 'bg-accent border-accent' : 'bg-bg3 border-[var(--c-border)]'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all
                        ${querNF ? 'left-5' : 'left-0.5'}`} />
                    </div>
                  </button>

                  {/* Campos NF */}
                  {querNF && (
                    <div className="mt-3 bg-bg2 border border-accent/20 rounded-lg p-5
                                    animate-fade-up">
                      <p className="font-mono text-[0.62rem] text-accent uppercase tracking-[0.08em] mb-4">
                        Dados para emissão da nota fiscal
                      </p>
                      <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">

                        <Field label="Nome / Razão Social *" error={nfErrors.razaoSocial} className="col-span-2 max-[600px]:col-span-1">
                          <input type="text" value={nf.razaoSocial}
                            placeholder="Nome completo ou razão social da empresa"
                            onChange={e => setNF(n => ({ ...n, razaoSocial: e.target.value }))}
                            className={inputCls(!!nfErrors.razaoSocial)} />
                        </Field>

                        <Field label="CPF / CNPJ *" error={nfErrors.cpfCnpj}>
                          <input type="text" value={nf.cpfCnpj} placeholder="000.000.000-00"
                            onChange={e => setNF(n => ({ ...n, cpfCnpj: maskCpfCnpj(e.target.value) }))}
                            className={inputCls(!!nfErrors.cpfCnpj)} />
                        </Field>

                        <Field label="E-mail para envio da NF *" error={nfErrors.email}>
                          <input type="email" value={nf.email} placeholder="seu@email.com"
                            onChange={e => setNF(n => ({ ...n, email: e.target.value }))}
                            className={inputCls(!!nfErrors.email)} />
                        </Field>

                        <Field label="CEP de cobrança" className="col-span-2 max-[600px]:col-span-1">
                          <div className="relative">
                            <input type="text" value={nfCep} placeholder="00000-000"
                              onChange={e => {
                                const v = maskCep(e.target.value)
                                setNfCep(v)
                                setNfCepStatus('idle')
                                if (v.replace(/\D/g, '').length === 8) buscarNfCep(v)
                              }}
                              className={inputCls(false)} />
                            {nfCepStatus === 'loading' && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                                <svg className="animate-spin w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                </svg>
                              </span>
                            )}
                            {nfCepStatus === 'ok'    && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 text-[0.75rem]">✓</span>}
                            {nfCepStatus === 'error' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 text-[0.72rem]">CEP inválido</span>}
                          </div>
                        </Field>

                        <Field label="Endereço de cobrança" className="col-span-2 max-[600px]:col-span-1">
                          <input type="text" value={nf.endereco}
                            placeholder="Preenchido pelo CEP ou digite manualmente"
                            onChange={e => setNF(n => ({ ...n, endereco: e.target.value }))}
                            className={inputCls(false)} />
                        </Field>

                        <Field label="Município *" error={nfErrors.municipio}>
                          <input type="text" value={nf.municipio} placeholder="Preenchido pelo CEP"
                            onChange={e => setNF(n => ({ ...n, municipio: e.target.value }))}
                            className={inputCls(!!nfErrors.municipio)} />
                        </Field>

                        <Field label="UF">
                          <select value={nf.uf} title="Estado (UF)"
                            onChange={e => setNF(n => ({ ...n, uf: e.target.value }))}
                            className={inputCls(false)}>
                            {UF_LIST.map(uf => (
                              <option key={uf} value={uf}>{uf}</option>
                            ))}
                          </select>
                        </Field>

                      </div>
                      <p className="font-mono text-[0.62rem] text-ink3 mt-4 leading-relaxed">
                        A nota fiscal será emitida após a conclusão do serviço e enviada ao e-mail informado.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-between">
                  <button type="button" onClick={() => setStep(1)}
                    className="flex items-center gap-2 px-5 py-2.5 border border-[var(--c-border)]
                               font-mono text-[0.78rem] text-ink2 rounded-sm cursor-pointer
                               hover:border-[var(--c-border2)] hover:text-ink transition-all">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                    </svg>
                    Voltar
                  </button>
                  <button type="button" onClick={() => goStep(3)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-accent text-white
                               font-bold text-[0.85rem] rounded-sm border border-accent cursor-pointer
                               hover:bg-accent-hover hover:shadow-[0_0_20px_rgba(79,142,247,0.3)] transition-all">
                    Continuar
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 3 — Finalizar */}
            {step === 3 && (
              <div className="animate-fade-up">
                <div className="mb-6 pb-5 border-b border-[var(--c-border)]">
                  <h1 className="font-sans text-2xl font-bold tracking-[-0.03em] text-ink">
                    Como deseja prosseguir?
                  </h1>
                  <p className="font-mono text-[0.7rem] text-ink3 mt-1 tracking-[0.05em] uppercase">
                    Escolha uma opção para finalizar seu pedido
                  </p>
                </div>

                {apiError && (
                  <div className="mb-4 px-4 py-3 rounded-lg bg-red-400/10 border border-red-400/25
                                  font-sans text-[0.85rem] text-red-400">
                    {apiError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">

                  {/* Card WhatsApp */}
                  <div className="bg-bg2 border border-[var(--c-border)] rounded-lg p-6
                                  hover:border-green-400/30 transition-all flex flex-col">
                    <div className="w-12 h-12 rounded-lg bg-green-400/10 border border-green-400/20
                                    flex items-center justify-center mb-4">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-green-400">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </div>
                    <h2 className="font-sans text-[1rem] font-bold text-ink mb-2">
                      Falar com atendente
                    </h2>
                    <p className="font-sans text-[0.82rem] text-ink2 leading-relaxed mb-4 flex-1">
                      Envie sua solicitação pelo WhatsApp e negocie diretamente com nossa equipe.
                    </p>
                    <ul className="space-y-1.5 mb-5">
                      {['Atendimento personalizado', 'Valores negociáveis', 'Pagamento combinado na entrega'].map(b => (
                        <li key={b} className="flex items-center gap-2 font-sans text-[0.78rem] text-ink2">
                          <span className="text-green-400 text-[0.65rem]">✓</span> {b}
                        </li>
                      ))}
                    </ul>
                    <button type="button" onClick={handleWhatsapp} disabled={loading}
                      className="w-full py-2.5 px-4 rounded-sm bg-green-500 text-white font-bold
                                 text-[0.85rem] cursor-pointer border border-green-500
                                 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed
                                 transition-all flex items-center justify-center gap-2">
                      {loading ? 'Enviando...' : 'Enviar pelo WhatsApp'}
                    </button>
                  </div>

                  {/* Card PIX */}
                  <div className="bg-bg2 border border-[var(--c-border)] rounded-lg p-6
                                  hover:border-accent/30 transition-all flex flex-col">
                    <div className="w-12 h-12 rounded-lg bg-accent/10 border border-accent/20
                                    flex items-center justify-center mb-4">
                      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-accent">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <h2 className="font-sans text-[1rem] font-bold text-ink mb-2">
                      Reservar com 50% de entrada
                    </h2>
                    <p className="font-sans text-[0.82rem] text-ink2 leading-relaxed mb-4 flex-1">
                      Solicite a reserva da sua data. Após confirmação da equipe, você receberá no WhatsApp a chave PIX com o valor de 50%.
                    </p>
                    <ul className="space-y-1.5 mb-5">
                      {['Data garantida após confirmação', '50% restante pago na entrega', 'Reembolso em caso de cancelamento'].map(b => (
                        <li key={b} className="flex items-center gap-2 font-sans text-[0.78rem] text-ink2">
                          <span className="text-accent text-[0.65rem]">✓</span> {b}
                        </li>
                      ))}
                    </ul>
                    <button type="button" onClick={handlePix} disabled={pixLoading}
                      className="w-full py-2.5 px-4 rounded-sm bg-accent text-white font-bold
                                 text-[0.85rem] cursor-pointer border border-accent
                                 hover:bg-accent-hover hover:shadow-[0_0_20px_rgba(79,142,247,0.3)]
                                 disabled:opacity-40 disabled:cursor-not-allowed
                                 transition-all flex items-center justify-center gap-2">
                      {pixLoading ? 'Enviando...' : 'Solicitar reserva via PIX'}
                      {!pixLoading && (
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex">
                  <button type="button" onClick={() => setStep(2)}
                    className="flex items-center gap-2 px-5 py-2.5 border border-[var(--c-border)]
                               font-mono text-[0.78rem] text-ink2 rounded-sm cursor-pointer
                               hover:border-[var(--c-border2)] hover:text-ink transition-all">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                    </svg>
                    Voltar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar: Resumo fixo ── */}
          <aside className="sticky top-6 max-[900px]:order-first max-[900px]:static">
            <div className="bg-bg2 border border-[var(--c-border)] rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--c-border)] bg-bg3">
                <h3 className="font-mono text-[0.62rem] font-semibold text-ink3 uppercase tracking-[0.1em]">
                  Resumo do pedido
                </h3>
              </div>

              <div className="p-4">
                {/* Itens selecionados */}
                {Object.keys(itens).length === 0 ? (
                  <p className="font-mono text-[0.72rem] text-ink3 text-center py-4">
                    Nenhum item selecionado
                  </p>
                ) : (
                  <div className="space-y-1.5 mb-4">
                    {Object.entries(itens).map(([item, qty]) => (
                      <div key={item} className="flex justify-between items-center">
                        <span className="font-sans text-[0.78rem] text-ink2 truncate mr-2">{item}</span>
                        <span className="font-mono text-[0.72rem] text-ink3 whitespace-nowrap">× {qty}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dados do pedido */}
                {(form.nome || form.data_entrega) && (
                  <div className="border-t border-[var(--c-border)] pt-3 space-y-1.5 mb-4">
                    {form.nome && (
                      <p className="font-sans text-[0.78rem] text-ink2">
                        <span className="text-ink3">Nome: </span>{form.nome}
                      </p>
                    )}
                    {form.data_entrega && (
                      <p className="font-sans text-[0.78rem] text-ink2">
                        <span className="text-ink3">Data: </span>{fmtDate(form.data_entrega)}
                      </p>
                    )}
                  </div>
                )}

                {/* Aviso de preços */}
                <div className="border-t border-[var(--c-border)] pt-3">
                  <p className="font-mono text-[0.62rem] text-ink3 leading-relaxed">
                    Os valores serão informados pela equipe após análise do pedido.
                  </p>
                </div>

                {/* Progresso */}
                <div className="border-t border-[var(--c-border)] pt-3 mt-3 space-y-1.5">
                  {[
                    { n: 1, label: 'Itens selecionados', done: totalItens > 0 },
                    { n: 2, label: 'Dados preenchidos',  done: step > 2 },
                    { n: 3, label: 'Finalização',        done: false },
                  ].map(s => (
                    <div key={s.n} className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center
                                        font-mono text-[0.55rem] font-bold transition-colors
                        ${s.done ? 'bg-accent/20 text-accent' : step === s.n ? 'bg-accent text-white' : 'bg-[var(--c-border)] text-ink3'}`}>
                        {s.done ? '✓' : s.n}
                      </span>
                      <span className={`font-sans text-[0.75rem] transition-colors
                        ${s.done ? 'text-accent' : step === s.n ? 'text-ink' : 'text-ink3'}`}>
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Botão Continuar abaixo do resumo — só aparece no step 1 */}
            {step === 1 && (
              <button type="button" onClick={() => goStep(2)}
                disabled={totalItens === 0}
                className="mt-3 w-full flex items-center justify-center gap-2 px-6 py-3
                           bg-accent text-white font-bold text-[0.85rem] rounded-sm border border-accent
                           cursor-pointer hover:bg-accent-hover
                           hover:shadow-[0_0_20px_rgba(79,142,247,0.3)]
                           disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                Continuar
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </aside>
        </div>
      </div>

      <footer className="border-t border-[var(--c-border)] mt-12">
        <div className="max-w-6xl mx-auto px-6 py-5 text-center">
          <p className="font-mono text-[0.62rem] text-ink3 tracking-[0.04em]">
            Hércules Festas — Aluguel de equipamentos para festas e eventos
          </p>
        </div>
      </footer>
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────

function PageHeader({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <header className="border-b border-[var(--c-border)] bg-bg2/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-accent/10 border border-accent/30 text-accent rounded
                          flex items-center justify-center font-mono text-[0.65rem] font-semibold">
            HF
          </div>
          <div>
            <span className="font-sans text-[0.95rem] font-bold tracking-[-0.02em] text-ink">
              Hércules Festas
            </span>
            <span className="ml-2 font-mono text-[0.62rem] text-ink3 uppercase tracking-[0.08em]">
              Solicitar orçamento
            </span>
          </div>
        </div>

        {/* Botão dark/light mode */}
        <button type="button" onClick={onToggle} title={dark ? 'Modo claro' : 'Modo escuro'}
          className="w-8 h-8 rounded-sm border border-[var(--c-border)] bg-bg3
                     flex items-center justify-center cursor-pointer
                     hover:border-[var(--c-border2)] hover:text-ink text-ink2 transition-all">
          {dark ? (
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
            </svg>
          ) : (
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  )
}

function Field({
  label, error, className = '', children,
}: {
  label: string; error?: string; className?: string; children: React.ReactNode
}) {
  return (
    <div className={className}>
      <label className="font-mono text-[0.62rem] text-ink3 uppercase tracking-[0.06em] mb-1.5 block">
        {label}
      </label>
      {children}
      {error && <p className="font-sans text-[0.72rem] text-red-400 mt-1">{error}</p>}
    </div>
  )
}

function inputCls(hasError: boolean) {
  return `w-full bg-bg3 border rounded px-3 py-2 font-sans text-[0.85rem] text-ink
    placeholder:text-ink3 focus:outline-none transition-all
    ${hasError
      ? 'border-red-400/40 focus:border-red-400/60 focus:ring-[3px] focus:ring-red-400/10'
      : 'border-[var(--c-border)] focus:border-accent/40 focus:ring-[3px] focus:ring-accent/6'}`
}
