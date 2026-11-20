import { catalog, dataset } from "@/lib/data";
import { HomeForm } from "@/components/HomeForm";

export default function Home() {
  return (
    <>
      {/* 同一会话再次进入时跳过入场动画（在绘制前执行） */}
      <script
        dangerouslySetInnerHTML={{
          __html: "try{if(sessionStorage.getItem('pl:visited'))document.documentElement.classList.add('returning')}catch(e){}",
        }}
      />
      <section className="hero">
        <h1 className="enter enter-once">两款手机，怎么选。</h1>
        <p className="enter enter-once" style={{ ["--i" as string]: 1 }}>
          选好机型，看清差异。
        </p>
      </section>
      <HomeForm catalog={catalog(dataset)} />
    </>
  );
}
