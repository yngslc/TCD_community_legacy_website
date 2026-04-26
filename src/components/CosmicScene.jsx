import { useRef, useState, useMemo, memo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Stars, Environment } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'

// ═══ INTRO ANIMATION ═══
// Module-scoped progress ref. Ramps 0 → 1 over INTRO_DURATION seconds on
// mount, driven by IntroController below. Every layer that should "explode"
// out from the core (orbs, orbital particles, energy lines) reads
// `intro.progress` inside its useFrame and multiplies its radial distance
// by it. We avoid useState so the value is read via direct property access
// per frame — no React re-renders.
const INTRO_DURATION = 3.5
const intro = { progress: 0 }
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

function IntroController() {
  const startRef = useRef(null)
  const three = useThree()
  // START: camera sits just outside the pile-at-origin — bubblemaps-style.
  // END: final wide establishing shot (was the original Canvas position).
  const START = useMemo(() => new THREE.Vector3(0, 0.2, 0.9), [])
  const END = useMemo(() => new THREE.Vector3(0, 7.5, 5), [])
  useFrame(({ clock }) => {
    if (startRef.current === null) startRef.current = clock.elapsedTime
    const raw = Math.min(1, (clock.elapsedTime - startRef.current) / INTRO_DURATION)
    const p = easeOutCubic(raw)
    intro.progress = p
    three.camera.position.lerpVectors(START, END, p)
    three.camera.lookAt(0, 0, 0)
  })
  return null
}

// ═══ TEXTURE HELPER ═══
function makeTex(sz=64,c=[1,1,1]){const cv=document.createElement('canvas');cv.width=cv.height=sz;const x=cv.getContext('2d'),g=x.createRadialGradient(sz/2,sz/2,0,sz/2,sz/2,sz/2);g.addColorStop(0,`rgba(${c[0]*255|0},${c[1]*255|0},${c[2]*255|0},1)`);g.addColorStop(.12,`rgba(${c[0]*255|0},${c[1]*255|0},${c[2]*255|0},.8)`);g.addColorStop(.35,`rgba(${c[0]*200|0},${c[1]*200|0},${c[2]*200|0},.25)`);g.addColorStop(.65,`rgba(${c[0]*120|0},${c[1]*120|0},${c[2]*120|0},.06)`);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,sz,sz);const t=new THREE.CanvasTexture(cv);t.needsUpdate=true;return t}

// LAYER 1: Star dust — fixed `dep  thWrite` typo (was splitting depthWrite into two invalid props)
function StarDust(){const ct=1500,ref=useRef(),tex=useMemo(()=>makeTex(32,[.7,.75,.9]),[]),pos=useMemo(()=>{const p=new Float32Array(ct*3);for(let i=0;i<ct;i++){const th=Math.random()*Math.PI*2,r=2+Math.random()*25;p[i*3]=Math.cos(th)*r;p[i*3+1]=(Math.random()-.5)*8;p[i*3+2]=Math.sin(th)*r}return p},[]);useFrame(({clock})=>{if(ref.current)ref.current.rotation.y=clock.getElapsedTime()*.003});return(<points ref={ref}><bufferGeometry><bufferAttribute attach="attributes-position" array={pos} count={ct} itemSize={3}/></bufferGeometry><pointsMaterial map={tex} size={.15} transparent opacity={.15} depthWrite={false} blending={THREE.AdditiveBlending} color="#93a6d5" sizeAttenuation/></points>)}

// LAYER 2: Orbital particles — positions scaled by intro.progress so they pile at origin, then sweep into their rings.
function OrbitalParticles(){const ct=5000,ref=useRef(),tex=useMemo(()=>makeTex(48,[.8,.85,1]),[]),data=useMemo(()=>{const p=new Float32Array(ct*3),m=[];for(let i=0;i<ct;i++){const ring=Math.floor(Math.random()*5),br=1.5+ring*1.4,a=Math.random()*Math.PI*2,r=br+(Math.random()-.5)*.8,y=(Math.random()-.5)*.6;p[i*3]=Math.cos(a)*r;p[i*3+1]=y;p[i*3+2]=Math.sin(a)*r;m.push({a,r,y,s:.015+Math.random()*.025,ring})}return{p,m}},[]);useFrame(({clock})=>{if(!ref.current)return;const t=clock.getElapsedTime(),pr=intro.progress,arr=ref.current.geometry.attributes.position.array;for(let i=0;i<ct;i++){const m=data.m[i],a=m.a+t*m.s*(m.ring%2===0?1:-1);arr[i*3]=Math.cos(a)*m.r*pr;arr[i*3+1]=(m.y+Math.sin(t*.5+i)*.05)*pr;arr[i*3+2]=Math.sin(a)*m.r*pr}ref.current.geometry.attributes.position.needsUpdate=true});return(<points ref={ref}><bufferGeometry><bufferAttribute attach="attributes-position" array={data.p} count={ct} itemSize={3}/></bufferGeometry><pointsMaterial map={tex} size={.14} transparent opacity={.25} depthWrite={false} blending={THREE.AdditiveBlending} color="#c7d7f6" sizeAttenuation/></points>)}

// LAYER 3: Glowing spheres
const SPHERES=(()=>{const s=[];let id=0;for(let arm=0;arm<2;arm++){const off=arm*Math.PI;for(let i=0;i<12;i++){const t=i/12,a=off+t*Math.PI*2.5,r=1+t*5,f=arm===0&&i>=7;s.push({id:id++,a,r,sz:f?.35+Math.random()*.3:.08+Math.random()*.18,sp:.04+Math.random()*.03,f})}}for(let i=0;i<12;i++)s.push({id:id++,a:Math.random()*Math.PI*2,r:Math.random()*1.2,sz:.04+Math.random()*.1,sp:.08+Math.random()*.06,f:false});return s})()

// ═══ PLANET TEXTURES — every orb gets one, deterministically ═══
// Mapping: setIndex = d.id % PLANET_TEXTURE_SETS.length.
// Sphere ids are assigned sequentially at module init and never change,
// so the same id always receives the same texture set across reloads.
// Diffuse textures are grayscaled at load-time (canvas-side pixel
// conversion to luminance) to guarantee a silver palette regardless of
// source hue (e.g. painted_metal_shutter is teal-green).
const PLANET_TEXTURE_SETS = [
  { diff: '/assets/textures/rusty_metal_04_diff_4k.jpg',        rough: '/assets/textures/rusty_metal_04_rough_4k.jpg', bump: '/assets/textures/rusty_metal_04_disp_4k.png' },
  { diff: '/assets/textures/rusty_metal_02_diff_4k.jpg',        rough: '/assets/textures/rusty_metal_02_rough_4k.jpg', bump: '/assets/textures/rusty_metal_02_disp_4k.png' },
  { diff: '/assets/textures/worn_concrete_floor_diff_4k.jpg',   rough: '/assets/textures/rusty_metal_05_rough_4k.jpg', bump: '/assets/textures/worn_concrete_floor_disp_4k.png' },
  { diff: '/assets/textures/painted_metal_shutter_diff_4k.jpg', rough: '/assets/textures/rusty_metal_02_rough_4k.jpg', bump: '/assets/textures/painted_metal_shutter_disp_4k.png' },
]
const SILVER_SHADES = ['#d8dce4','#bfc3ce','#e8ebf0','#b0b4be','#c8ccd4']

const _imgCache = new Map(), _canvasCache = new Map()
function _loadImg(u){if(_imgCache.has(u))return _imgCache.get(u);const p=new Promise((res,rej)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>res(i);i.onerror=rej;i.src=u});_imgCache.set(u,p);return p}
function _processed(url, gray, size){
  const k = `${url}|${gray?'g':'c'}|${size}`
  if (_canvasCache.has(k)) return _canvasCache.get(k)
  const p = _loadImg(url).then(img=>{
    const s = Math.min(1, size/Math.max(img.width, img.height))
    const w = Math.max(1, Math.round(img.width*s)), h = Math.max(1, Math.round(img.height*s))
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h)
    if (gray) {
      const id = x.getImageData(0,0,w,h), d = id.data
      for (let i=0; i<d.length; i+=4) {
        const lum = .299*d[i] + .587*d[i+1] + .114*d[i+2]
        d[i] = d[i+1] = d[i+2] = lum
      }
      x.putImageData(id, 0, 0)
    }s
    return c
  })
  _canvasCache.set(k, p); return p
}
function makePlanetMap(url, {gray=false, srgb=false, rep=1, rot=0, size=1024} = {}){
  const t = new THREE.Texture()
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(rep, rep); t.center.set(.5, .5); t.rotation = rot
  if (srgb && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace
  _processed(url, gray, size).then(c=>{ t.image = c; t.needsUpdate = true }).catch(()=>{})
  return t
}

const _smallSets = []
function smallSet(i){
  if (_smallSets[i]) return _smallSets[i]
  const s = PLANET_TEXTURE_SETS[i]
  const set = {
    map: makePlanetMap(s.diff,  { gray: true,  srgb: true,  size: 512 }),
    roughnessMap: makePlanetMap(s.rough, { gray: false, srgb: false, size: 512 }),
    bumpMap: makePlanetMap(s.bump, { gray: false, srgb: false, size: 512 }),
  }
  _smallSets[i] = set
  return set
}

const haloTex = makeTex(64, [.55, .85, 2])
const glowTex = makeTex(128, [1, 1, 1])
function GlowSphere({d, onClick}){
  const ref = useRef(), [h, setH] = useState(false)
  // Per-orb mesh rotation: deterministic from d.id. For small orbs this is
  // the equivalent of featured's per-texture rep/rot — each orb shows a
  // different slice of the shared texture instead of looking like a clone.
  const baseRot = useMemo(() => [
    ((d.id*37)%360)*Math.PI/180,
    ((d.id*61)%360)*Math.PI/180,
    ((d.id*83)%360)*Math.PI/180,
  ], [d.id])
  const mat = useMemo(() => {
    const i = d.id % PLANET_TEXTURE_SETS.length
    const tint = SILVER_SHADES[d.id % SILVER_SHADES.length]
    if (d.f) {
      const rep = 0.9 + ((d.id*97) % 125)/100 * 0.8
      const rot = ((d.id*53) % 360) * Math.PI/180
      const set = PLANET_TEXTURE_SETS[i]
      return {
        kind: 'featured',
        map: makePlanetMap(set.diff,  { gray: true,  srgb: true,  rep, rot, size: 1024 }),
        roughnessMap: makePlanetMap(set.rough, { gray: false, srgb: false, rep, rot, size: 1024 }),
        bumpMap: makePlanetMap(set.bump, { gray: false, srgb: false, rep, rot, size: 1024 }),
        tint,
      }
    }
    const shared = smallSet(i)
    return { kind: 'small', map: shared.map, roughnessMap: shared.roughnessMap, bumpMap: shared.bumpMap, tint }
  }, [d.id, d.f])
  // Position is scaled by intro.progress so every orb starts piled at the
  // origin and sweeps outward to its final orbit as the camera pulls back.
  useFrame(({clock})=>{if(!ref.current)return;const t=clock.getElapsedTime()*d.sp,pr=intro.progress;ref.current.position.set(Math.cos(d.a+t)*d.r*pr,Math.sin(t*.3+d.id*.5)*.1*pr,Math.sin(d.a+t)*d.r*pr)})
  return(<group ref={ref}>
    <mesh rotation={baseRot} onClick={d.f?(e)=>{e.stopPropagation();onClick()}:undefined} onPointerOver={d.f?()=>{setH(true);document.body.style.cursor='pointer'}:undefined} onPointerOut={d.f?()=>{setH(false);document.body.style.cursor='default'}:undefined}>
      <sphereGeometry args={[d.sz,d.f?48:32,d.f?48:24]}/>
      {mat.kind==='featured'?
        <meshStandardMaterial transparent opacity={1} map={mat.map} roughnessMap={mat.roughnessMap} bumpMap={mat.bumpMap} bumpScale={.05} emissiveMap={mat.map} color={mat.tint} metalness={.5} roughness={.62} envMapIntensity={1.0} emissive={h?'#e6e6e6':'#9aa4c2'} emissiveIntensity={h?2.6:.75}/>
        :
        <meshStandardMaterial transparent opacity={1} map={mat.map} roughnessMap={mat.roughnessMap} bumpMap={mat.bumpMap} bumpScale={.05} emissiveMap={mat.map} color={mat.tint} metalness={.5} roughness={.62} envMapIntensity={1} emissive='#9aa4c2' emissiveIntensity={1}/>
      }
    </mesh>
    <sprite scale={d.f?[d.sz*3.8,d.sz*3.8,1]:[Math.max(.6,d.sz*4.5),Math.max(.6,d.sz*4.5),1]} raycast={()=>null}>
      <spriteMaterial map={glowTex} transparent opacity={d.f?.42:.55} blending={THREE.AdditiveBlending} depthWrite={false} color={d.f?'#ffffff':'#cfd6ee'}/>
    </sprite>
    <sprite scale={d.f?[d.sz*1.9,d.sz*1.9,1]:[Math.max(.32,d.sz*2.3),Math.max(.32,d.sz*2.3),1]} raycast={()=>null}>
      <spriteMaterial map={glowTex} transparent opacity={d.f?1:.75} blending={THREE.AdditiveBlending} depthWrite={false} color="#ffffff"/>
    </sprite>
  </group>)
}

// ═══ ORB TRAILS ═══
// One shared lineSegments draw call for every orb's motion trail. Each orb
// keeps a ring buffer of past positions; segments are rebuilt per frame
// with vertex colors fading head→tail. Additive blending + vertex color
// ramp gives a smooth glow without per-frame opacity pulsing.
function OrbTrails(){
  const TRAIL_LEN=12
  const SEGS=TRAIL_LEN-1
  const ref=useRef()
  const matRef=useRef()
  const history=useMemo(()=>SPHERES.map(()=>new Float32Array(TRAIL_LEN*3)),[])
  const seededRef=useRef(false)
  const total=SPHERES.length*SEGS
  const positions=useMemo(()=>new Float32Array(total*6),[total])
  const colors=useMemo(()=>new Float32Array(total*6),[total])
  useFrame(({clock},delta)=>{
    if(!ref.current||!matRef.current)return
    const t=clock.getElapsedTime(),pr=intro.progress
    // Hide while intro plays — orbs explode out from origin and the ring
    // buffer would render as long radial lines back to the central pile.
    // Also re-seed when the frame loop pauses (alt-tab) and resumes with
    // a large delta; otherwise stale buffer entries connect old→new
    // positions as long chord lines across the scene.
    if(pr<1||delta>0.1){
      seededRef.current=false
      matRef.current.opacity=0
      return
    }
    if(matRef.current.opacity<1)matRef.current.opacity=Math.min(1,matRef.current.opacity+delta*3)
    for(let i=0;i<SPHERES.length;i++){
      const d=SPHERES[i],tt=t*d.sp
      const px=Math.cos(d.a+tt)*d.r
      const py=Math.sin(tt*.3+d.id*.5)*.1
      const pz=Math.sin(d.a+tt)*d.r
      const h=history[i]
      if(!seededRef.current){
        for(let k=0;k<TRAIL_LEN;k++){h[k*3]=px;h[k*3+1]=py;h[k*3+2]=pz}
      }else{
        for(let k=TRAIL_LEN-1;k>0;k--){h[k*3]=h[(k-1)*3];h[k*3+1]=h[(k-1)*3+1];h[k*3+2]=h[(k-1)*3+2]}
        h[0]=px;h[1]=py;h[2]=pz
      }
    }
    seededRef.current=true
    for(let i=0;i<SPHERES.length;i++){
      const d=SPHERES[i],h=history[i]
      const peak=d.f?.9:.38
      for(let k=0;k<SEGS;k++){
        const idx=(i*SEGS+k)*6
        positions[idx]=h[k*3];positions[idx+1]=h[k*3+1];positions[idx+2]=h[k*3+2]
        positions[idx+3]=h[(k+1)*3];positions[idx+4]=h[(k+1)*3+1];positions[idx+5]=h[(k+1)*3+2]
        const f0=peak*(1-k/SEGS), f1=peak*(1-(k+1)/SEGS)
        colors[idx]=f0*.82;colors[idx+1]=f0*.9;colors[idx+2]=f0
        colors[idx+3]=f1*.82;colors[idx+4]=f1*.9;colors[idx+5]=f1
      }
    }
    ref.current.geometry.attributes.position.needsUpdate=true
    ref.current.geometry.attributes.color.needsUpdate=true
  })
  return(<lineSegments ref={ref}>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" array={positions} count={total*2} itemSize={3}/>
      <bufferAttribute attach="attributes-color" array={colors} count={total*2} itemSize={3}/>
    </bufferGeometry>
    <lineBasicMaterial ref={matRef} vertexColors transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false}/>
  </lineSegments>)
}

// Energy lines — endpoints scaled by intro.progress; opacity fades in with it too.
function EnergyLines(){const ref=useRef(),matRef=useRef();useFrame(({clock})=>{if(!ref.current)return;const t=clock.getElapsedTime(),pr=intro.progress;if(matRef.current)matRef.current.opacity=(.04+Math.sin(t*.3)*.02)*pr;const pos=[];for(let i=0;i<SPHERES.length;i++){const a=SPHERES[i],at=t*a.sp,ax=Math.cos(a.a+at)*a.r*pr,az=Math.sin(a.a+at)*a.r*pr;for(let j=i+1;j<SPHERES.length;j++){const b=SPHERES[j],bt=t*b.sp,bx=Math.cos(b.a+bt)*b.r*pr,bz=Math.sin(b.a+bt)*b.r*pr;if(Math.sqrt((ax-bx)**2+(az-bz)**2)<2){pos.push(ax,Math.sin(t*.3+a.id*.5)*.1*pr,az,bx,Math.sin(t*.3+b.id*.5)*.1*pr,bz)}}}ref.current.geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));ref.current.geometry.attributes.position.needsUpdate=true});return(<lineSegments ref={ref}><bufferGeometry/><lineBasicMaterial ref={matRef} color="#4a5880" transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false}/></lineSegments>)}

// Nebula + core
function Nebula(){const clouds=useMemo(()=>Array.from({length:8},()=>({p:[(Math.random()-.5)*6,(Math.random()-.5)*1.5,(Math.random()-.5)*6],s:3+Math.random()*5,o:.012+Math.random()*.018})),[]),tex=useMemo(()=>makeTex(128,[.4,.45,.6]),[]),coreTex=useMemo(()=>makeTex(128,[.8,.8,1]),[]),coreRef=useRef();useFrame(({clock})=>{if(coreRef.current){const p=1+Math.sin(clock.getElapsedTime()*.5)*.1;coreRef.current.scale.set(3*p,3*p,1)}});return(<>{clouds.map((c,i)=><sprite key={i} position={c.p} scale={[c.s,c.s,1]}><spriteMaterial map={tex} transparent opacity={c.o} blending={THREE.AdditiveBlending} depthWrite={false} color="#5060a0"/></sprite>)}<sprite ref={coreRef} position={[0,0,0]} scale={[3,3,1]}><spriteMaterial map={coreTex} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} color="#7888c0"/></sprite><sprite position={[0,.1,0]} scale={[5,5,1]}><spriteMaterial map={coreTex} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} color="#c0c8e0"/></sprite><sprite position={[0,-.05,0]} scale={[8,8,1]}><spriteMaterial map={coreTex} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} color="#d0d4e8"/></sprite><sprite position={[.3,.05,-.2]} scale={[3,3,1]}><spriteMaterial map={coreTex} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} color="#b8c0d8"/></sprite><sprite position={[-.4,.05,.3]} scale={[2.5,2.5,1]}><spriteMaterial map={coreTex} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} color="#a8b0c8"/></sprite></>)}

// ═══ SCENE ═══
// Fixes vs. the previous inline version:
//   - fog range was [20,20] (degenerate: near === far caused division
//     issues in fog math). Replaced with a valid [18,90] range.
//   - Bloom no longer uses `mipmapBlur`. Under extreme ambient lighting
//     (intensity=100) the mipmap chain was upsampling hot pixels at the
//     scene centre into a visible axis-aligned square. Classic bloom
//     keeps the same silvery glow without the box artifact.
const CosmicScene = memo(function CosmicScene({onOrbClick}){
  return(<>
    <color attach="background" args={['#020115']}/>
    <fog attach="fog" args={['#020115',18,90]}/>
    <ambientLight intensity={14} color="#adbed1"/>
    <pointLight position={[-2,4,0]} intensity={10} color="#8090c0" distance={15} decay={15}/>
    <pointLight position={[0,1,0]} intensity={5} color="#9bbad1d2" distance={1980} decay={2.5}/>
    <pointLight position={[0,1,0]} intensity={.75} color="#e0e4f0" distance={250} decay={2.5}/>
    <pointLight position={[5,3,5]} intensity={1.5} color="#6878b0" distance={14} decay={2}/>
    <pointLight position={[0,2,-5]} intensity={0} color="#5868a8" distance={12} decay={2}/>
    <Environment preset="night"/>
    <Stars radius={25} depth={75} count={3500} factor={3.5} saturation={10} fade speed={.2}/>
    <IntroController/>
    <StarDust/>
    <Nebula/>
    <OrbitalParticles/>
    <OrbTrails/>
    <EnergyLines/>
    {SPHERES.map(s=><GlowSphere key={s.id} d={s} onClick={onOrbClick}/>)}
    <EffectComposer>
      <Bloom intensity={.5} luminanceThreshold={1.5} luminanceSmoothing={.35} radius={.65}/>
      <Vignette eskil={false} offset={.35} darkness={.55} blendFunction={BlendFunction.NORMAL}/>
    </EffectComposer>
  </>)
})

export default CosmicScene
