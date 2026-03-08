// Toast — notifiche temporanee (success, error, info)
export default function Toast({ message, type = 'info' }) {
  return <div className={`toast toast--${type}`}>{message}</div>;
}
