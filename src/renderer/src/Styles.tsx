import { useEffect, useState } from 'react'
import type { StyleInfo } from '../../shared/api'

export default function StylesView(): React.JSX.Element {
  const [styles, setStyles] = useState<StyleInfo[]>([])
  useEffect(() => void window.chapel.styles.list().then(setStyles), [])
  return (
    <div className="page">
      <h1>Styles</h1>
      <p className="lede">A style is the recipe Claude follows when it cuts your edit.</p>
      <div className="table">
        {styles.map((s) => (
          <div key={s.name} className="table-row"><span className="mono">{s.name}</span><span>{s.description}</span></div>
        ))}
      </div>
    </div>
  )
}
