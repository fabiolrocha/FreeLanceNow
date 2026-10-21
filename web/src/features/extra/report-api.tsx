import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../../app/store'
import { adminApi } from '../../data/admin'
import { ErrorMessage, PageTitle } from '../../components/ui'

export function ApiReport() {
  const [params] = useSearchParams(),
    { pathname } = useLocation(),
    navigate = useNavigate(),
    { services } = useApp()
  const [target, setTarget] = useState(params.get('id') || ''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const type =
    params.get('type') === 'POST' ? 'POST' : params.get('type') === 'REVIEW' ? 'REVIEW' : 'SERVICE'
  const sent = pathname.endsWith('enviada')
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
              A denúncia foi registrada. Um administrador poderá analisar o conteúdo e registrar sua
              decisão.
            </p>
            <Link to="/inicio">Voltar ao início</Link>
          </>
        ) : (
          <form onSubmit={(e) => void submit(e)}>
            {params.get('id') ? (
              <p>
                Conteúdo:{' '}
                {params.get('alvo') ||
                  (type === 'POST'
                    ? 'Publicação selecionada'
                    : type === 'REVIEW'
                      ? 'Avaliação selecionada'
                      : 'Anúncio selecionado')}
              </p>
            ) : (
              <label className="field">
                <span>Anúncio a denunciar</span>
                <select required value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">Selecione o anúncio</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field">
              <span>Motivo *</span>
              <select name="reason" required>
                {[
                  'Conteúdo ofensivo',
                  'Anúncio incorreto',
                  'Avaliação suspeita',
                  'Outro motivo',
                ].map((reason) => (
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
