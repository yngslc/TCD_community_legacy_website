import { useRef, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

// ═══ STAR PARTICLES — thousands of twinkling points ═══
function StarField() {
  const ref = useRef()
  const count = 2500

  const [positions, sizes, phases] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const sz = new Float32Array(count)
    const ph = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      // Distribute in a large sphere
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 8 + Math.random() * 40
      pos[i*3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i*3+2] = r * Math.cos(phi)
      sz[i] = 0.02 + Math.random() * 0.06
      ph[i] = Math.random() * Math.PI * 2
    }
    return [pos, sz, ph]
  }, [])

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    const geo = ref.current.geometry
    const sizeAttr = geo.getAttribute('size')
    for (let i = 0; i < count; i++) {
      const twinkle = 0.5 + 0.5 * Math.sin(t * (0.5 + phases[i]) + phases[i] * 10)
      sizeAttr.array[i] = sizes[i] * twinkle
    }
    sizeAttr.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={count} array={new Float32Array(sizes)} itemSize={1} />
      </bufferGeometry>
      <pointsMaterial
        color="#d0d5e8"
        size={0.04}
        sizeAttenuation
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

// ═══ SINGLE ORB — 3D sphere with specular highlight ═══
function Orb({ position, size, opacity, featured, onClick, orbRef }) {
  const meshRef = useRef()
  const glowRef = useRef()

  useFrame(({ clock }) => {
    if (glowRef.current) {
      const pulse = 1 + 0.05 * Math.sin(clock.elapsedTime * 0.5)
      glowRef.current.scale.setScalar(pulse)
    }
  })

  return (
    <group position={position} ref={orbRef}>
      {/* Glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[size * (featured ? 2.5 : 1.8), 16, 16]} />
        <meshBasicMaterial
          color="#b0bcd8"
          transparent
          opacity={opacity * (featured ? 0.06 : 0.03)}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Main sphere */}
      <mesh
        ref={meshRef}
        onClick={featured ? onClick : undefined}
        onPointerOver={featured ? (e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' } : undefined}
        onPointerOut={featured ? () => { document.body.style.cursor = 'default' } : undefined}
      >
        <sphereGeometry args={[size, featured ? 32 : 16, featured ? 32 : 16]} />
        <meshStandardMaterial
          color="#c8d0e0"
          emissive="#8090b0"
          emissiveIntensity={featured ? 0.3 : 0.15}
          roughness={0.3}
          metalness={0.6}
          transparent
          opacity={opacity}
          envMapIntensity={0.5}
        />
      </mesh>

      {/* Specular highlight spot */}
      {size > 0.15 && (
        <mesh position={[-size*0.25, size*0.3, size*0.7]}>
          <sphereGeometry args={[size * 0.2, 8, 8]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={opacity * 0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Featured ring */}
      {featured && (
        <mesh rotation={[Math.PI/2, 0, 0]}>
          <ringGeometry args={[size * 1.2, size * 1.3, 64]} />
          <meshBasicMaterial
            color="#c0cce0"
            transparent
            opacity={0.1}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  )
}

// ═══ ORBITAL SYSTEM — orbs on spiral paths with connections ═══
function OrbitalSystem({ onOrbClick }) {
  const groupRef = useRef()
  const orbRefs = useRef([])
  const lineRef = useRef()

  const orbData = useMemo(() => {
    const orbs = []
    let id = 0
    const arms = 2

    // Spiral arms
    for (let arm = 0; arm < arms; arm++) {
      const armOff = (arm / arms) * Math.PI * 2
      const orbCount = 20
      for (let i = 0; i < orbCount; i++) {
        const t = i / orbCount
        const angle = armOff + t * Math.PI * 2.8
        const r = 0.5 + t * 5
        const featured = arm === 0 && i >= orbCount - 5
        const size = featured ? (0.25 + Math.random()*0.35) : (0.04 + Math.random() * (0.2 - t*0.12))
        const jx = (Math.random()-0.5)*0.4
        const jy = (Math.random()-0.5)*0.4
        const jz = (Math.random()-0.5)*0.3
        orbs.push({
          id: id++, angle, radius: r, size, featured,
          speed: 0.015 + Math.random()*0.01,
          opacity: featured ? 0.85 : 0.25 + Math.random()*0.4,
          jitter: [jx, jy, jz],
        })
      }
    }

    // Center cluster
    for (let i = 0; i < 25; i++) {
      const a = Math.random()*Math.PI*2
      const r = Math.random()*1.2
      orbs.push({
        id: id++, angle: a, radius: r,
        size: 0.03 + Math.random()*0.1,
        featured: false,
        speed: 0.03 + Math.random()*0.02,
        opacity: 0.3 + Math.random()*0.4,
        jitter: [(Math.random()-0.5)*0.2, (Math.random()-0.5)*0.2, (Math.random()-0.5)*0.15],
      })
    }

    // Distant scattered
    for (let i = 0; i < 15; i++) {
      const a = Math.random()*Math.PI*2
      const r = 5 + Math.random()*3
      orbs.push({
        id: id++, angle: a, radius: r,
        size: 0.05 + Math.random()*0.12,
        featured: false,
        speed: 0.008 + Math.random()*0.005,
        opacity: 0.15 + Math.random()*0.15,
        jitter: [(Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5, (Math.random()-0.5)*0.3],
      })
    }

    return orbs
  }, [])

  // Connection pairs — nearby orbs
  const connections = useMemo(() => {
    const conns = []
    for (let i = 0; i < orbData.length; i++) {
      for (let j = i+1; j < orbData.length; j++) {
        const dr = Math.abs(orbData[i].radius - orbData[j].radius)
        const da = Math.abs(orbData[i].angle - orbData[j].angle) % (Math.PI*2)
        if (dr < 1.5 && da < 0.8 && Math.random() > 0.6) {
          conns.push([i, j])
        }
      }
      if (conns.length > 120) break // cap for performance
    }
    return conns
  }, [orbData])

  const linePositions = useMemo(() => new Float32Array(connections.length * 6), [connections])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.elapsedTime

    // Slow rotation of entire system
    groupRef.current.rotation.z = t * 0.008

    // Update orb positions
    orbData.forEach((orb, i) => {
      const ref = orbRefs.current[i]
      if (!ref) return
      const a = orb.angle + t * orb.speed
      const x = Math.cos(a) * orb.radius + orb.jitter[0]
      const y = Math.sin(a) * orb.radius + orb.jitter[1]
      const z = orb.jitter[2]
      ref.position.set(x, y, z)
    })

    // Update connection lines
    if (lineRef.current) {
      const pos = lineRef.current.geometry.getAttribute('position')
      connections.forEach(([a, b], idx) => {
        const ra = orbRefs.current[a], rb = orbRefs.current[b]
        if (!ra || !rb) return
        pos.array[idx*6] = ra.position.x
        pos.array[idx*6+1] = ra.position.y
        pos.array[idx*6+2] = ra.position.z
        pos.array[idx*6+3] = rb.position.x
        pos.array[idx*6+4] = rb.position.y
        pos.array[idx*6+5] = rb.position.z
      })
      pos.needsUpdate = true
    }
  })

  return (
    <group ref={groupRef}>
      {/* Connection lines */}
      <lineSegments ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={connections.length * 2} array={linePositions} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color="#8090b8" transparent opacity={0.06} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>

      {/* Orbs */}
      {orbData.map((orb, i) => (
        <Orb
          key={orb.id}
          position={[Math.cos(orb.angle)*orb.radius + orb.jitter[0], Math.sin(orb.angle)*orb.radius + orb.jitter[1], orb.jitter[2]]}
          size={orb.size}
          opacity={orb.opacity}
          featured={orb.featured}
          onClick={orb.featured ? (e) => { e.stopPropagation(); onOrbClick(orb.id) } : undefined}
          orbRef={el => orbRefs.current[i] = el}
        />
      ))}
    </group>
  )
}

// ═══ GAS CLOUDS — soft nebula blobs ═══
function GasClouds() {
  const ref = useRef()

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = clock.elapsedTime * 0.003
  })

  return (
    <group ref={ref}>
      {Array.from({length: 6}, (_, i) => {
        const a = (i/6)*Math.PI*2
        const r = 2 + Math.random()*2
        return (
          <mesh key={i} position={[Math.cos(a)*r, Math.sin(a)*r, -1 + Math.random()*2]}>
            <planeGeometry args={[3+Math.random()*3, 3+Math.random()*3]} />
            <meshBasicMaterial
              color="#6070a0"
              transparent
              opacity={0.012 + Math.random()*0.01}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}
    </group>
  )
}

// ═══ CENTER GLOW ═══
function CenterGlow() {
  return (
    <mesh>
      <sphereGeometry args={[0.8, 32, 32]} />
      <meshBasicMaterial
        color="#a0b0d0"
        transparent
        opacity={0.04}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}

// ═══ LIGHT RAYS ═══
function LightRays() {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = clock.elapsedTime * 0.005
  })

  return (
    <group ref={ref}>
      {Array.from({length: 8}, (_, i) => {
        const a = (i/8)*Math.PI*2
        return (
          <mesh key={i} position={[0,0,0]} rotation={[0, 0, a]}>
            <planeGeometry args={[0.02, 4]} />
            <meshBasicMaterial
              color="#b0c0e0"
              transparent
              opacity={0.015}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}
    </group>
  )
}

// ═══ SCENE ═══
function Scene({ onOrbClick }) {
  return (
    <>
      <color attach="background" args={['#030208']} />
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 0, 3]} intensity={0.8} color="#c0d0f0" />
      <pointLight position={[0, 0, -2]} intensity={0.3} color="#8090b0" />

      <StarField />
      <GasClouds />
      <CenterGlow />
      <LightRays />
      <OrbitalSystem onOrbClick={onOrbClick} />

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.15}
          luminanceSmoothing={0.9}
          intensity={1.2}
          radius={0.8}
        />
      </EffectComposer>
    </>
  )
}

// ═══ EXPORTED CANVAS WRAPPER ═══
export default function CosmicScene({ onOrbClick }) {
  return (
    <div className="r3f-bg">
      <Canvas
        camera={{ position: [0, 0, 10], fov: 55, near: 0.1, far: 100 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <Scene onOrbClick={onOrbClick} />
      </Canvas>
    </div>
  )
}
