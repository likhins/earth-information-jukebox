"use client";
import { useEffect, useRef } from "react";
type Particle = { x:number; y:number; tx:number; ty:number; size:number; phase:number };

export default function StarText() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0, particles: Particle[] = [], width = 0, height = 0;
    let observer: ResizeObserver | undefined;

    const build = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width); height = Math.max(1, rect.height);
      canvas.width = Math.round(width*dpr); canvas.height = Math.round(height*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
      const off = document.createElement("canvas");
      off.width = Math.round(width); off.height = Math.round(height);
      const t = off.getContext("2d"); if (!t) return;
      const small = width < 390, label = small ? 8 : 9, title = small ? 35 : Math.min(46,width*.105), body = small ? 12 : 13;
      t.fillStyle="#fff"; t.textBaseline="top";
      t.font="500 "+label+"px ui-monospace, SFMono-Regular, Menlo, monospace";
      t.fillText("POLARIS  ·  EARTH INFORMATION JUKEBOX",1,5);
      t.font="500 "+title+"px Arial, Helvetica, sans-serif";
      t.fillText("Listen beyond",0,42); t.fillText("what you can see.",0,42+title*1.08);
      t.font="400 "+body+"px Arial, Helvetica, sans-serif";
      t.fillText("An exploration of our planet through data,",1,42+title*2.28);
      t.fillText("patterns and sound.",1,42+title*2.28+body*1.65);
      const pixels=t.getImageData(0,0,off.width,off.height), targets:{x:number;y:number}[]=[];
      for(let y=0;y<off.height;y+=3) for(let x=0;x<off.width;x+=3)
        if(pixels.data[(y*off.width+x)*4+3]>110) targets.push({x,y});
      particles=targets.map((q,i)=>({x:Math.random()*width,y:Math.random()*height,tx:q.x,ty:q.y,size:i%7===0?1.35:.9,phase:Math.random()*Math.PI*2}));
    };
    const draw=(now:number)=>{
      ctx.clearRect(0,0,width,height);
      const progress=reduced?1:Math.min(1,Math.max(0,(now-500)/2400));
      const ease=1-Math.pow(1-progress,3);
      for(const p of particles){
        const x=p.x+(p.tx-p.x)*ease,y=p.y+(p.ty-p.y)*ease;
        const twinkle=reduced?.9:.68+.32*Math.sin(now*.0014+p.phase);
        ctx.beginPath(); ctx.fillStyle="rgba(224,239,255,"+((.18+.82*ease)*twinkle)+")";
        ctx.shadowColor="rgba(155,205,255,.75)"; ctx.shadowBlur=ease>.7?3:1;
        ctx.arc(x,y,p.size,0,Math.PI*2); ctx.fill();
      }
      ctx.shadowBlur=0; if(!reduced) frame=requestAnimationFrame(draw);
    };
    build(); frame=requestAnimationFrame(draw);
    observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);build();frame=requestAnimationFrame(draw);});
    observer.observe(canvas);
    return ()=>{cancelAnimationFrame(frame);observer?.disconnect();};
  },[]);
  return <div className="star-text-wrap" role="img" aria-label="Polaris. Listen beyond what you can see. An exploration of our planet through data, patterns and sound.">
    <canvas ref={canvasRef} className="star-text-canvas" />
    <div className="sr-only"><p>Polaris · Earth Information Jukebox</p><h1>Listen beyond what you can see.</h1><p>An exploration of our planet through data, patterns and sound.</p></div>
  </div>;
}
