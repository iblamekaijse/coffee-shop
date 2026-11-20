import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, MoveHorizontal } from 'lucide-react';
import { drinks, ingredients, pastries } from './catalog';

const TOTAL = drinks.length;
const wrap = (index: number, length: number) => ((index % length) + length) % length;

function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

type DragState = { x: number; y: number; progress: number; id: number; active: boolean };

function DrinkCarousel({ onActiveChange }: { onActiveChange: (index: number) => void }) {
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const raf = useRef<number | null>(null);
  const drag = useRef<DragState | null>(null);
  const lastPointerDrag = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const update = useCallback((p: number) => {
    progressRef.current = p;
    setProgress(p);
    onActiveChange(wrap(Math.round(p), TOTAL));
  }, [onActiveChange]);

  const cancelAnimation = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
  }, []);

  useEffect(() => () => cancelAnimation(), [cancelAnimation]);

  const animateTo = useCallback((destination: number) => {
    cancelAnimation();
    if (reduced) { update(destination); return; }
    const start = progressRef.current;
    const delta = destination - start;
    const startAt = performance.now();
    const duration = Math.min(850, 610 + Math.max(0, Math.abs(delta) - 1) * 85);
    const tick = (now: number) => {
      const t = Math.min(1, (now - startAt) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      update(start + delta * eased);
      raf.current = t < 1 ? requestAnimationFrame(tick) : null;
    };
    raf.current = requestAnimationFrame(tick);
  }, [cancelAnimation, reduced, update]);

  const step = useCallback((delta: number) => {
    const nearest = Math.round(progressRef.current);
    animateTo(nearest + delta);
  }, [animateTo]);

  const select = useCallback((index: number) => {
    if (lastPointerDrag.current) return;
    const current = Math.round(progressRef.current);
    let delta = wrap(index - wrap(current, TOTAL), TOTAL);
    if (delta > TOTAL / 2) delta -= TOTAL;
    animateTo(current + delta);
  }, [animateTo]);

  // Native pointer listeners keep mouse, pen and touch behavior consistent.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      cancelAnimation();
      lastPointerDrag.current = false;
      drag.current = { x: event.clientX, y: event.clientY, id: event.pointerId, progress: progressRef.current, active: false };
    };
    const onPointerMove = (event: PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      const dx = event.clientX - d.x;
      const dy = event.clientY - d.y;
      if (!d.active && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.1) {
        d.active = true;
        lastPointerDrag.current = true;
        if (stage.isConnected) { try { stage.setPointerCapture(event.pointerId); } catch { /* Synthetic pointer events may not be capturable. */ } }
      }
      if (d.active) {
        event.preventDefault();
        const sensitivity = Math.max(85, Math.min(160, stage.clientWidth * 0.19));
        update(d.progress - dx / sensitivity);
      }
    };
    const finishPointer = (event: PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      drag.current = null;
      if (d.active) {
        if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
        animateTo(Math.round(progressRef.current));
        window.setTimeout(() => { lastPointerDrag.current = false; }, 100);
      }
    };
    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', finishPointer);
    stage.addEventListener('pointercancel', finishPointer);
    return () => {
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerup', finishPointer);
      stage.removeEventListener('pointercancel', finishPointer);
    };
  }, [cancelAnimation, animateTo, update]);

  const active = wrap(Math.round(progress), TOTAL);

  return (
    <div className="gallery" id="напитки">
      <div className="gallery__topnote" aria-hidden="true">THE COFFEE COLLECTION <span>—</span> VOL. 01</div>
      <div className="stage" ref={stageRef} tabIndex={0} role="region" aria-roledescription="карусель напитков" aria-label="Восемь авторских напитков. Используй стрелки влево и вправо для переключения" data-testid="drink-stage"
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
          if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
        }}>
        <div className="stage__haze" aria-hidden="true" />
        <div className="stage__orbit stage__orbit--back" aria-hidden="true" />
        <span className="stage__tiny-label" aria-hidden="true">01 — 08 / СЛОЙ</span>
        {drinks.map((drink, index) => {
          const angle = Math.PI * 2 * (index - progress) / TOTAL;
          const depth = (1 + Math.cos(angle)) / 2;
          const x = 50 + Math.sin(angle) * 41;
          const y = 43 + Math.cos(angle) * 16 + Math.sin(angle) * 3;
          const scale = 0.30 + Math.pow(depth, 3) * 0.94;
          const style: CSSProperties = {
            left: `${x}%`, top: `${y}%`,
            transform: `translate(-50%, -50%) scale(${scale})`,
            opacity: 0.40 + depth * 0.6,
            zIndex: Math.round(depth * 100) + 2,
            filter: `blur(${Math.pow(1 - depth, 1.7) * 1.6}px)`,
          };
          return (
            <button key={drink.number} type="button" className={`drink-object ${active === index ? 'drink-object--active' : ''}`}
              style={style} aria-label={`Выбрать: ${drink.name}`} aria-pressed={active === index} tabIndex={-1}
              onClick={() => select(index)} data-testid={`drink-${index}`}>
              <img src={drink.image} alt={drink.alt} draggable={false} loading={index < 5 ? 'eager' : 'lazy'} />
            </button>
          );
        })}
        <div className="stage__orbit stage__orbit--front" aria-hidden="true" />
        <div className="stage__floor" aria-hidden="true" />
      </div>
      <div className="gallery__footer">
        <div className="gallery__hint"><MoveHorizontal size={18} strokeWidth={1.4} /> <span>ТЯНИ, ЧТОБЫ ВЫБРАТЬ</span></div>
        <div className="gallery__controls" aria-label="Управление напитками">
          <button className="round-button" onClick={() => step(-1)} type="button" aria-label="Предыдущий напиток" data-testid="drink-prev"><ArrowLeft size={21} strokeWidth={1.35}/></button>
          <div className="count" aria-live="polite"><strong>{String(active + 1).padStart(2, '0')}</strong><span className="count__line" />{String(TOTAL).padStart(2, '0')}</div>
          <button className="round-button round-button--filled" onClick={() => step(1)} type="button" aria-label="Следующий напиток" data-testid="drink-next"><ArrowRight size={21} strokeWidth={1.35}/></button>
        </div>
        <div className="gallery__dots" aria-label="Выбор напитка">
          {drinks.map((drink, index) => <button key={drink.number} className={`dot ${active === index ? 'dot--active' : ''}`} onClick={() => select(index)} type="button" aria-label={`Показать напиток ${index + 1}: ${drink.name}`} aria-current={active === index ? 'true' : undefined} />)}
        </div>
      </div>
      <div className="gallery__mobile-caption" aria-live="polite">
        <span className="overline">НАПИТОК {drinks[active].number} / 08</span>
        <h2>{drinks[active].name}</h2>
        <p>{drinks[active].taste}</p>
      </div>
    </div>
  );
}

function Brand() {
  return <a className="brand" href="#главная" aria-label="СЛОЙ, на главную">
    <span className="brand__mark" aria-hidden="true"><i/><i/><i/></span><span className="brand__text">СЛОЙ</span>
  </a>;
}

function ArrowLink({ href, children, contrast = false }: { href: string, children: string, contrast?: boolean }) {
  return <a className={`pill-link ${contrast ? 'pill-link--dark' : ''}`} href={href}>{children}<ArrowRight size={19} strokeWidth={1.4}/></a>;
}

function Bakery() {
  const [index, setIndex] = useState(0);
  const current = pastries[index];
  const change = (dir: number) => setIndex((old) => wrap(old + dir, pastries.length));
  return <section className="bakery section-shell" id="выпечка" aria-label="Выпечка">
    <div className="bakery__intro">
      <span className="overline"><span className="overline__dash"/> МАЛЕНЬКИЕ РАДОСТИ</span>
      <h2 className="section-heading">Из <em>печи</em></h2>
      <p>Мягкая сердцевина, хрустящие слои и то самое ощущение первого укуса.</p>
      <div className="bakery__index">02 <span>/</span> К НАШЕМУ КОФЕ</div>
    </div>
    <div className="bakery__photo-wrap">
      <div className="bakery__photo-bg" aria-hidden="true"/>
      <img className="bakery__photo" key={current.image} src={current.image} alt={current.alt} data-testid="pastry-image" />
      <span className="bakery__photo-number">0{index + 1} / 03</span>
    </div>
    <div className="bakery__details" aria-live="polite">
      <span className="overline">{current.note} / 0{index + 1}</span>
      <h3>{current.name}</h3>
      <p>{current.description}</p>
      <div className="bakery__controls">
        <button className="round-button round-button--cream" aria-label="Предыдущая выпечка" onClick={() => change(-1)} data-testid="pastry-prev"><ArrowLeft size={21} strokeWidth={1.35}/></button>
        <span className="bakery__counter"><strong>0{index+1}</strong> / 03</span>
        <button className="round-button round-button--dark" aria-label="Следующая выпечка" onClick={() => change(1)} data-testid="pastry-next"><ArrowRight size={21} strokeWidth={1.35}/></button>
      </div>
      <div className="bakery__selectors" aria-label="Виды выпечки">
        {pastries.map((item, i) => <button key={item.name} className={i === index ? 'selector selector--active' : 'selector'} onClick={() => setIndex(i)} aria-label={item.name} aria-pressed={i === index} type="button" />)}
      </div>
    </div>
  </section>;
}

function Ingredients() {
  return <section className="ingredients" id="ингредиенты" aria-labelledby="ingredient-title">
    <div className="ingredients__head section-shell">
      <div>
        <span className="overline"><span className="overline__dash"/> ВАЖНА КАЖДАЯ ДЕТАЛЬ</span>
        <h2 className="section-heading" id="ingredient-title">Из чего <em>складывается</em><br/> вкус</h2>
      </div>
      <p>Мы любим простые продукты за их способность превращаться во что-то необыкновенное.</p>
    </div>
    <div className="ingredients__grid section-shell">
      {ingredients.map((item, index) => <article className={`ingredient-card ingredient-card--${index+1}`} key={item.name}>
        <div className="ingredient-card__media"><img src={item.image} alt={item.alt} loading="lazy" /></div>
        <div className="ingredient-card__text"><span className="ingredient-card__number">0{index+1} / НАТУРАЛЬНО</span><h3>{item.name}</h3><p>{item.description}</p></div>
      </article>)}
    </div>
    <div className="ingredients__bottom section-shell"><span>СЛОИ СМЫСЛА. СЛОИ ВКУСА.</span><ArrowLink href="#напитки" contrast>К напиткам</ArrowLink></div>
  </section>;
}

function App() {
  const [active, setActive] = useState(0);
  const drink = drinks[active];
  const heroStyle = { '--drink-glow': drink.glow } as CSSProperties;
  return <>
    <div className="hero" id="главная" style={heroStyle}>
      <div className="hero__grain" aria-hidden="true"/>
      <header className="header section-shell">
        <Brand />
        <nav className="header__nav" aria-label="Главная навигация">
          <a href="#напитки">Напитки</a><a href="#выпечка">Выпечка</a><a href="#ингредиенты">Ингредиенты</a>
        </nav>
        <span className="header__aside">КОФЕЙНЯ С ХАРАКТЕРОМ</span>
      </header>
      <main>
        <div className="hero__content section-shell">
          <div className="hero__copy">
            <div className="hero__eyebrow"><span className="eyebrow__line"/> АВТОРСКАЯ КОФЕЙНЯ <span className="eyebrow__num">/ 01</span></div>
            <h1>Кофе в<br/>несколько<br/><em>слоёв.</em></h1>
            <p className="hero__lead">Знакомые вкусы в неожиданных сочетаниях. Каждый слой — отдельная история.</p>
            <div className="hero__selection" aria-live="polite">
              <div className="hero__selection-label"><span className="selection__line"/> СЕГОДНЯ В ЦЕНТРЕ ВНИМАНИЯ <span>0{active+1} / 08</span></div>
              <h2>{drink.name}</h2>
              <p>{drink.taste}</p>
              <span className="hero__composition">{drink.detail}</span>
            </div>
            <div className="hero__cta"><ArrowLink href="#выпечка">К выпечке</ArrowLink><a className="text-link" href="#ингредиенты">Наши ингредиенты <ArrowDown size={17}/></a></div>
          </div>
          <DrinkCarousel onActiveChange={setActive}/>
        </div>
        <div className="hero__bottom section-shell"><span>РУЧНАЯ РАБОТА. КАЖДЫЙ СЛОЙ.</span><a href="#выпечка">ЛИСТАЙ НИЖЕ <ArrowDown size={16}/></a><span>01 / 03</span></div>
      </main>
    </div>
    <Bakery />
    <Ingredients />
    <footer className="footer section-shell"><Brand/><p>СЛОЙ. Кофе, который хочется рассматривать.</p><a href="#главная">НАВЕРХ ↑</a><small>© {new Date().getFullYear()} СЛОЙ. Вымышленная кофейня.</small></footer>
  </>;
}

export default App;
