import { useEffect, useRef } from 'react'

export default function CosmicCanvas({ onOrbClick }) {
  const canvasRef = useRef(null)
  const mouseRef = useRef({ x: -999, y: -999 })
  const orbsRef = useRef([])
  const gaRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas.getContext('2d')
    let w, h, cx, cy, animId, dpr

    const stars = Array.from({length:700},()=>({ x:Math.random(),y:Math.random(),r:0.15+Math.random()*0.8,b:0.15+Math.random()*0.6,sp:0.3+Math.random()*2.5,off:Math.random()*Math.PI*2 }))
    const sparkles = Array.from({length:40},()=>({ x:Math.random(),y:Math.random(),r:1+Math.random()*2,b:0.5+Math.random()*0.5,sp:0.8+Math.random()*1.5,off:Math.random()*Math.PI*2 }))

    const orbs = []; let oid = 0
    for (let arm = 0; arm < 2; arm++) {
      const ao = (arm/2)*Math.PI*2
      for (let i = 0; i < 18; i++) {
        const t = i/18, th = ao+t*Math.PI*3.5, sr = 0.04+t*0.38+(Math.random()-0.5)*0.03
        const sz = t<0.15?2+Math.random()*5:t<0.4?4+Math.random()*10:t<0.7?8+Math.random()*18:15+Math.random()*28
        orbs.push({id:oid++,theta:th,spiralR:sr,size:sz,featured:false,opacity:0.3+t*0.5,sm:0.8+Math.random()*0.4})
      }
    }
    for (let i=0;i<20;i++) orbs.push({id:oid++,theta:Math.random()*Math.PI*2,spiralR:Math.random()*0.06,size:1.5+Math.random()*4,featured:false,opacity:0.25+Math.random()*0.3,sm:1.2+Math.random()*0.5})
    for (let i=0;i<15;i++) orbs.push({id:oid++,theta:Math.random()*Math.PI*2,spiralR:0.35+Math.random()*0.12,size:2+Math.random()*6,featured:false,opacity:0.12+Math.random()*0.15,sm:0.6+Math.random()*0.3})

    ;[...orbs].sort((a,b)=>b.size-a.size).slice(0,5).forEach(o=>o.featured=true)

    const conns = []
    for (let i=0;i<orbs.length;i++) for (let j=i+1;j<orbs.length;j++) {
      const dr=Math.abs(orbs[i].spiralR-orbs[j].spiralR), da=Math.abs(orbs[i].theta-orbs[j].theta)%(Math.PI*2), ad=Math.min(da,Math.PI*2-da)
      if(dr<0.08&&ad<0.8&&Math.random()>0.3) conns.push([i,j])
    }
    orbsRef.current = orbs

    const resize=()=>{dpr=window.devicePixelRatio||1;w=canvas.width=window.innerWidth*dpr;h=canvas.height=window.innerHeight*dpr;canvas.style.width=window.innerWidth+'px';canvas.style.height=window.innerHeight+'px';cx=w/2;cy=h/2}
    resize(); window.addEventListener('resize',resize)

    const gxy=(o,ga)=>{const a=o.theta+ga*o.sm,md=Math.min(w,h),r=o.spiralR*md*0.5;return{x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r}}

    const drawOrb=(x,y,r,op,feat,hov)=>{
      if(r<0.5)return;ctx.save()
      const gr=r*(feat?3.5:2.2),gl=ctx.createRadialGradient(x,y,r*0.2,x,y,gr);gl.addColorStop(0,`rgba(210,220,240,${op*(hov?0.25:0.1)})`);gl.addColorStop(0.5,`rgba(190,200,220,${op*0.03})`);gl.addColorStop(1,'rgba(190,200,220,0)');ctx.fillStyle=gl;ctx.beginPath();ctx.arc(x,y,gr,0,Math.PI*2);ctx.fill()
      const g1=ctx.createRadialGradient(x-r*0.35,y-r*0.35,r*0.05,x+r*0.1,y+r*0.1,r);g1.addColorStop(0,`rgba(240,243,250,${op*0.7})`);g1.addColorStop(0.2,`rgba(200,210,225,${op*0.5})`);g1.addColorStop(0.5,`rgba(140,150,175,${op*0.3})`);g1.addColorStop(0.8,`rgba(70,80,100,${op*0.15})`);g1.addColorStop(1,`rgba(25,30,45,${op*0.05})`);ctx.fillStyle=g1;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()
      const sR=r*0.4,sp=ctx.createRadialGradient(x-r*0.28,y-r*0.32,0,x-r*0.28,y-r*0.32,sR);sp.addColorStop(0,`rgba(255,255,255,${op*0.8})`);sp.addColorStop(0.4,`rgba(255,255,255,${op*0.3})`);sp.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=sp;ctx.beginPath();ctx.arc(x-r*0.28,y-r*0.32,sR,0,Math.PI*2);ctx.fill()
      if(r>4*dpr){const rim=ctx.createRadialGradient(x+r*0.2,y+r*0.3,r*0.6,x+r*0.2,y+r*0.3,r*1.1);rim.addColorStop(0,'rgba(255,255,255,0)');rim.addColorStop(0.8,`rgba(200,210,230,${op*0.08})`);rim.addColorStop(1,`rgba(200,210,230,${op*0.15})`);ctx.fillStyle=rim;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
      if(feat){ctx.strokeStyle=`rgba(220,230,245,${hov?0.4:0.15})`;ctx.lineWidth=(hov?2:1)*dpr;ctx.beginPath();ctx.arc(x,y,r+5*dpr,0,Math.PI*2);ctx.stroke();if(hov){const hg=ctx.createRadialGradient(x,y,r,x,y,r+15*dpr);hg.addColorStop(0,'rgba(220,230,245,0.08)');hg.addColorStop(1,'rgba(220,230,245,0)');ctx.fillStyle=hg;ctx.beginPath();ctx.arc(x,y,r+15*dpr,0,Math.PI*2);ctx.fill()}}
      ctx.restore()
    }

    const animate=(time)=>{
      gaRef.current+=0.0003;const ga=gaRef.current;ctx.clearRect(0,0,w,h)
      ctx.fillStyle='#030208';ctx.fillRect(0,0,w,h)
      const md=Math.min(w,h)
      for(let i=0;i<5;i++){const a=(i/5)*Math.PI*2+ga*0.3,d=md*(0.08+i*0.04),nx=cx+Math.cos(a)*d,ny=cy+Math.sin(a)*d,nr=md*(0.15+Math.random()*0.02),ng=ctx.createRadialGradient(nx,ny,0,nx,ny,nr);ng.addColorStop(0,`rgba(160,170,200,${0.015+i*0.003})`);ng.addColorStop(0.5,'rgba(130,140,170,0.006)');ng.addColorStop(1,'rgba(100,110,140,0)');ctx.fillStyle=ng;ctx.fillRect(0,0,w,h)}
      const cn=ctx.createRadialGradient(cx,cy,0,cx,cy,md*0.18);cn.addColorStop(0,'rgba(200,210,235,0.08)');cn.addColorStop(0.3,'rgba(170,180,210,0.04)');cn.addColorStop(0.7,'rgba(130,140,170,0.015)');cn.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=cn;ctx.fillRect(0,0,w,h)
      ctx.save();ctx.translate(cx,cy);ctx.rotate(ga*0.5);for(let i=0;i<12;i++){const ra=(i/12)*Math.PI*2,len=md*0.22,lg=ctx.createLinearGradient(0,0,Math.cos(ra)*len,Math.sin(ra)*len);lg.addColorStop(0,'rgba(210,220,240,0.035)');lg.addColorStop(0.5,'rgba(210,220,240,0.01)');lg.addColorStop(1,'rgba(210,220,240,0)');ctx.strokeStyle=lg;ctx.lineWidth=(1.5+Math.sin(time*0.0005+i)*0.5)*dpr;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(ra)*len,Math.sin(ra)*len);ctx.stroke()};ctx.restore()
      stars.forEach(s=>{const tw=0.4+0.6*Math.sin(time*0.001*s.sp+s.off);ctx.fillStyle=`rgba(215,220,235,${s.b*tw})`;ctx.beginPath();ctx.arc(s.x*w,s.y*h,s.r*dpr,0,Math.PI*2);ctx.fill()})
      sparkles.forEach(s=>{const tw=0.3+0.7*Math.sin(time*0.0008*s.sp+s.off),a=s.b*tw,sx=s.x*w,sy=s.y*h,sr=s.r*dpr*3;ctx.strokeStyle=`rgba(240,245,255,${a*0.5})`;ctx.lineWidth=0.5*dpr;ctx.beginPath();ctx.moveTo(sx-sr,sy);ctx.lineTo(sx+sr,sy);ctx.stroke();ctx.beginPath();ctx.moveTo(sx,sy-sr);ctx.lineTo(sx,sy+sr);ctx.stroke();ctx.fillStyle=`rgba(255,255,255,${a})`;ctx.beginPath();ctx.arc(sx,sy,s.r*dpr,0,Math.PI*2);ctx.fill()})
      const pos=orbs.map(o=>gxy(o,ga))
      ctx.save();ctx.filter=`blur(${1.5*dpr}px)`;conns.forEach(([a,b])=>{const pa=pos[a],pb=pos[b],al=Math.min(orbs[a].opacity,orbs[b].opacity)*0.15;ctx.strokeStyle=`rgba(190,200,220,${al})`;ctx.lineWidth=0.6*dpr;ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke()});ctx.restore()
      conns.forEach(([a,b])=>{const pa=pos[a],pb=pos[b];ctx.strokeStyle=`rgba(200,210,230,${Math.min(orbs[a].opacity,orbs[b].opacity)*0.06})`;ctx.lineWidth=0.3*dpr;ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke()})
      ctx.save();ctx.translate(cx,cy);ctx.rotate(ga*2);for(let ring=0;ring<4;ring++){const rr=(10+ring*12)*dpr,pts=6+ring*3;ctx.strokeStyle=`rgba(210,220,240,${0.04-ring*0.008})`;ctx.lineWidth=0.5*dpr;ctx.beginPath();for(let i=0;i<=pts;i++){const a=(i/pts)*Math.PI*2;if(i===0)ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);else ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr)};ctx.stroke();for(let i=0;i<pts;i++){const a1=(i/pts)*Math.PI*2,a2=((i+Math.floor(pts/2))/pts)*Math.PI*2;ctx.strokeStyle='rgba(210,220,240,0.02)';ctx.beginPath();ctx.moveTo(Math.cos(a1)*rr,Math.sin(a1)*rr);ctx.lineTo(Math.cos(a2)*rr,Math.sin(a2)*rr);ctx.stroke()}};ctx.restore()
      const mx=mouseRef.current.x*dpr,my=mouseRef.current.y*dpr
      orbs.forEach((o,i)=>{const p=pos[i],r=o.size*dpr,d=Math.sqrt((mx-p.x)**2+(my-p.y)**2),hov=o.featured&&d<r+14*dpr;o._sx=p.x/dpr;o._sy=p.y/dpr;o._sr=o.size;drawOrb(p.x,p.y,r,o.opacity,o.featured,hov)})
      const vig=ctx.createRadialGradient(cx,cy,md*0.1,cx,cy,md*0.62);vig.addColorStop(0,'rgba(3,2,8,0)');vig.addColorStop(0.4,'rgba(3,2,8,0.2)');vig.addColorStop(0.7,'rgba(3,2,8,0.65)');vig.addColorStop(1,'rgba(3,2,8,0.96)');ctx.fillStyle=vig;ctx.fillRect(0,0,w,h)
      animId=requestAnimationFrame(animate)
    }
    animId=requestAnimationFrame(animate)

    const onMove=e=>{mouseRef.current={x:e.clientX,y:e.clientY};const hit=orbsRef.current.find(o=>o.featured&&o._sx!==undefined&&Math.sqrt((e.clientX-o._sx)**2+(e.clientY-o._sy)**2)<o._sr+14);canvas.style.cursor=hit?'pointer':'default'}
    const onClick=e=>{const hit=orbsRef.current.find(o=>o.featured&&o._sx!==undefined&&Math.sqrt((e.clientX-o._sx)**2+(e.clientY-o._sy)**2)<o._sr+14);if(hit)onOrbClick(hit.id)}
    canvas.addEventListener('mousemove',onMove);canvas.addEventListener('click',onClick)
    return()=>{cancelAnimationFrame(animId);window.removeEventListener('resize',resize);canvas.removeEventListener('mousemove',onMove);canvas.removeEventListener('click',onClick)}
  }, [onOrbClick])

  return <canvas ref={canvasRef} id="cosmic-canvas" />
}
