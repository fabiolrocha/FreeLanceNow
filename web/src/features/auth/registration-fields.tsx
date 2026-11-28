import { Link } from 'react-router-dom'
import { Field } from '../../components/ui'

export function RegistrationPhone() {
  return (
    <Field
      label="Telefone"
      name="phone"
      type="tel"
      required
      pattern={'\\+?[0-9 \\(\\)\\-]{10,20}'}
      autoComplete="tel"
      placeholder="(61) 99999-0000"
    />
  )
}

export function RegistrationTerms() {
  return (
    <label className="check">
      <input type="checkbox" name="terms" required />
      <span>
        Li os{' '}
        <Link to="/termos" target="_blank">
          termos de uso
        </Link>{' '}
        e a{' '}
        <Link to="/privacidade" target="_blank">
          política de privacidade
        </Link>{' '}
        e autorizo o uso dos meus dados para operar minha conta.
      </span>
    </label>
  )
}
