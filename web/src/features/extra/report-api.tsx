import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { adminApi } from '../../data/admin'
import { ErrorMessage, PageTitle } from '../../components/ui'

export function ApiReport() {
  const [params] = useSearchParams(),
    { pathname } = useLocation(),
    navigate = useNavigate()
  const target = params.get('id') || ''
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const type =
    params.get('type') === 'POST' ? 'POST' : params.get('type') === 'REVIEW' ? 'REVIEW' : 'SERVICE'
  const sent = pathname.endsWith('enviada')
  const reasons =
    type === 'REVIEW'
      ? ['Avaliação falsa ou suspeita', 'Conteúdo ofensivo', 'Outro motivo']
      : type === 'POST'
        ? ['Conteúdo ofensivo', 'Spam ou propaganda', 'Possível golpe', 'Outro motivo']
        : ['Anúncio enganoso ou incorreto', 'Conteúdo ofensivo', 'Possível golpe', 'Outro motivo']
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const d = new FormData(e.currentTarget)
    try {
      await adminApi.createReport({
        targetType: type,
        targetId: target,
        reason: String(d.get('reason')),
        comment: String(d.get('comment')),
      })
      navigate('/denunciar/enviada')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageTitle
        title={sent ? 'Denúncia registrada' : 'Denunciar conteúdo'}
        description="O relato fica salvo para análise da moderação."
      />
      <section className="form-panel">
        {sent ? (
          <>
            <p>
              A denúncia foi registrada. A administração vai analisar o conteúdo e você acompanha a
              decisão em Minhas denúncias.
            </p>
            <Link to="/denuncias">Ver minhas denúncias</Link>
          </>
        ) : !target ? (
          <>
            <p>
              Para denunciar, abra o anúncio, a avaliação ou a publicação e use o link
              &quot;Denunciar&quot; ao lado do conteúdo. Assim a moderação recebe exatamente o que
              você viu.
            </p>
            <Link to="/denuncias">Acompanhar minhas denúncias</Link>
          </>
        ) : (
          <form onSubmit={(e) => void submit(e)}>
            {
              <p>
                Conteúdo:{' '}
                {params.get('alvo') ||
                  (type === 'POST'
                    ? 'Publicação selecionada'
                    : type === 'REVIEW'
                      ? 'Avaliação selecionada'
                      : 'Anúncio selecionado')}
              </p>
            }
            <label className="field">
              <span>Motivo *</span>
              <select name="reason" required>
                {reasons.map((reason) => (
                  <option key={reason}>{reason}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>O que aconteceu? *</span>
              <textarea name="comment" minLength={40} maxLength={1000} required rows={5} />
            </label>
            <p>O relato e uma cópia do conteúdo serão preservados para análise.</p>
            <ErrorMessage message={error} />
            <button className="button" disabled={busy}>
              {busy ? 'Enviando…' : 'Enviar denúncia'}
            </button>
          </form>
        )}
      </section>
    </>
  )
}
