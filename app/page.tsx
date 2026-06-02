'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useMotionValue, useMotionTemplate } from 'motion/react';
import {
  ArrowRight,
  Star,
  Users,
  MessageSquare,
  Shield,
  Clock,
  BookOpen,
  Globe2,
  Check,
  Plus,
  Compass,
  Headset,
  BookMarked,
  Map,
  BadgeAlert,
  Briefcase,
  Menu,
  X
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

// Premium Multilingual Floating Background Component
function FloatingLanguages() {
  const chars = [
    { char: 'A', left: '10%', top: '20%', delay: 0 },
    { char: 'ع', left: '85%', top: '15%', delay: 1 },
    { char: 'Ж', left: '75%', top: '65%', delay: 2 },
    { char: '文', left: '15%', top: '75%', delay: 0.5 },
    { char: 'Fr', left: '5%', top: '45%', delay: 1.5 },
    { char: 'De', left: '90%', top: '45%', delay: 2.5 },
    { char: 'あ', left: '50%', top: '10%', delay: 0.8 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
      {chars.map((c, i) => (
         <motion.div
           key={i}
           className="absolute font-rosmatika text-brand-muted/20 text-6xl md:text-8xl select-none"
           style={{ left: c.left, top: c.top }}
           animate={{ y: [0, -30, 0], x: [0, 10, -10, 0], opacity: [0.1, 0.3, 0.1], rotate: [0, 10, -5, 0] }}
           transition={{ duration: 15 + i * 2, repeat: Infinity, delay: c.delay, ease: "easeInOut" }}
         >
           {c.char}
         </motion.div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden font-neubau">
      <Navbar />
      <main>
        <Hero />
        <WhyZumra />
        <HowItWorks />
        <LanguagesGrid />
        <FeaturedPrograms />
        <ConsultationCTA />
        <InstructorsTeaser />
        <Testimonials />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}

// --- SEC 1: NAVBAR ---
function Navbar() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    return scrollY.on("change", (latest) => {
      setScrolled(latest > 20);
    });
  }, [scrollY]);

  return (
    <motion.header 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ease-out ${scrolled ? 'bg-white/90 backdrop-blur-md border-b border-black/5 shadow-sm py-0' : 'bg-transparent border-transparent py-2'}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 items-center grid grid-cols-[1fr_auto] md:grid-cols-3 gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center text-white shadow-sm premium-shadow">
            <div className="w-3 h-3 bg-brand-muted rounded-full" />
          </div>
          <span className="font-rosmatika text-2xl font-bold tracking-tight text-brand-dark">
            Zümra<span className="text-brand-muted font-neubau text-[11px] font-bold tracking-widest uppercase ml-2 align-middle border-l border-brand-muted/30 pl-2">Akademi</span>
          </span>
        </div>
        <nav className="hidden md:flex justify-center gap-10 text-[13px] font-bold uppercase tracking-widest text-brand-dark/70">
          <a href="#neden-biz" className="hover:text-brand-primary transition-colors">Neden Biz?</a>
          <a href="#nasil-calisiyoruz" className="hover:text-brand-primary transition-colors">Süreç</a>
          <a href="#programlar" className="hover:text-brand-primary transition-colors">Programlar</a>
        </nav>
        <div className="flex justify-end gap-4 items-center">
          <button className="hidden sm:block text-sm font-semibold text-brand-dark/80 hover:text-brand-primary transition-colors">
            Giriş Yap
          </button>
          <button className="hidden sm:block px-6 py-2.5 bg-brand-primary text-white text-[11px] font-bold uppercase tracking-widest rounded-full shadow-lg shadow-brand-primary/20 hover:scale-105 transition-transform shrink-0 glow-effect">
            Seviye Tespiti
          </button>
          <button
            type="button"
            aria-label="Menüyü aç"
            onClick={() => setIsOpen((value) => !value)}
            className="md:hidden w-11 h-11 rounded-full bg-white/90 border border-black/5 shadow-sm flex items-center justify-center text-brand-dark"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      <div className={`md:hidden overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-80 border-t border-black/5 bg-white/95 backdrop-blur-md' : 'max-h-0'}`}>
        <nav className="site-container py-4 grid gap-2 text-[12px] font-bold uppercase tracking-widest text-brand-dark/70">
          <a href="#neden-biz" onClick={() => setIsOpen(false)} className="rounded-2xl px-4 py-3 hover:bg-brand-primary/5 hover:text-brand-primary transition-colors">Neden Biz?</a>
          <a href="#nasil-calisiyoruz" onClick={() => setIsOpen(false)} className="rounded-2xl px-4 py-3 hover:bg-brand-primary/5 hover:text-brand-primary transition-colors">Süreç</a>
          <a href="#programlar" onClick={() => setIsOpen(false)} className="rounded-2xl px-4 py-3 hover:bg-brand-primary/5 hover:text-brand-primary transition-colors">Programlar</a>
          <button className="mt-2 rounded-2xl bg-brand-primary px-4 py-3 text-left text-white shadow-lg shadow-brand-primary/20">Seviye Tespiti</button>
        </nav>
      </div>
    </motion.header>
  );
}

// --- SEC 2: HERO ---
function Hero() {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 1000], [0, 200]);
  const y2 = useTransform(scrollY, [0, 1000], [0, 100]);

  return (
    <section className="relative pt-32 sm:pt-40 pb-20 sm:pb-28 lg:pt-56 lg:pb-40 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#F8F5FC] via-white to-white -z-20" />
      <FloatingLanguages />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid xl:grid-cols-2 gap-12 lg:gap-16 items-center relative z-10">
        
        {/* Left Column */}
        <motion.div
           style={{ y: y2 }}
          className="space-y-6 lg:space-y-8"
        >
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-primary/5 text-brand-primary text-[10px] font-bold uppercase tracking-widest rounded-full w-fit border border-brand-primary/10"
          >
            Türkiye&apos;nin Kadınlara Özel İlk Akademisi
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-[44px] sm:text-[52px] md:text-[64px] lg:text-[80px] font-medium leading-[0.95] tracking-tight text-brand-dark font-rosmatika"
          >
            Kendin gibi hisset, <br />
            <span className="text-brand-primary italic pr-2">özgürce</span> öğren.
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="text-base sm:text-lg md:text-xl text-brand-dark/70 leading-relaxed max-w-xl font-neubau"
          >
            Kadınlara özel güvenli online ortamımızda, kendi hızınızda ilerleyin; 
            hedeflerinize odaklanarak dil becerilerinizi cesurca geliştirin. 
            Esnek saatler ve uzman eğitmenlerle yepyeni bir deneyim.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row gap-5 pt-4"
          >
            <motion.button 
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="px-8 py-4 bg-brand-primary text-white rounded-[1rem] font-bold uppercase tracking-wider text-xs shadow-2xl shadow-brand-primary/30 flex items-center justify-center gap-3 hover:shadow-brand-primary/40 transition-shadow glow-effect"
            >
              Seviyeni Belirle <ArrowRight className="w-4 h-4" />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.03, backgroundColor: 'rgba(83,48,137,0.05)' }}
              whileTap={{ scale: 0.97 }}
              className="px-8 py-4 border border-brand-dark/10 text-brand-dark rounded-[1rem] font-bold uppercase tracking-wider text-xs hover:border-brand-primary/30 transition-colors flex items-center justify-center gap-2"
            >
              Programları İncele
            </motion.button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 1 }}
            className="pt-8 lg:pt-10 flex flex-wrap gap-x-6 lg:gap-x-8 gap-y-4 items-center text-[12px] sm:text-[13px] font-bold text-brand-dark/70 uppercase tracking-widest"
          >
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-brand-primary" />
              <span>3500+ Öğrenci</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-brand-primary" />
              <span>%100 Online</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-brand-primary" />
              <span>Sadece Kadınlar</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Right Column Educational Visual */}
        <motion.div
          style={{ y: y1 }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full h-[550px] lg:h-[650px] hidden md:block"
        >
          <div className="absolute inset-0 bg-white/60 backdrop-blur-xl rounded-[3rem] premium-shadow border border-white overflow-hidden p-3 group">
            <div className="relative w-full h-full rounded-[2.5rem] overflow-hidden">
               <Image 
                  src="https://picsum.photos/seed/womeneducate/800/1000" 
                  alt="Confident woman studying" 
                  fill 
                  className="object-cover transition-transform duration-[30s] ease-out group-hover:scale-110" 
                  referrerPolicy="no-referrer" 
               />
               <div className="absolute inset-0 bg-brand-dark/10 mix-blend-overlay" />
               <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-brand-dark/80 via-brand-dark/20 to-transparent" />
               
               {/* Elegant central card overlaid */}
               <motion.div 
                 whileHover={{ y: -5 }}
                 className="absolute bottom-10 left-10 right-10 z-10 glass-card p-8 rounded-[2rem] border border-white/20 shadow-2xl flex flex-col items-start"
               >
                 <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white mb-6">
                   <Globe2 className="w-6 h-6" />
                 </div>
                 <div className="font-rosmatika text-3xl text-white mb-3 leading-snug">
                   &quot;Speak your <br/><span className="italic text-brand-muted">mind.</span>&quot;
                 </div>
                 <p className="text-[13px] font-neubau text-white/80 leading-relaxed max-w-[250px]">
                   A purely supportive, women-exclusive space designed to amplify your voice.
                 </p>
               </motion.div>
            </div>

            {/* Floating Badge */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-16 -left-8 bg-white px-6 py-4 rounded-2xl premium-shadow z-20 border border-brand-primary/5 flex items-center gap-4 glow-effect"
            >
              <div className="w-12 h-12 rounded-full bg-brand-primary/5 flex items-center justify-center text-brand-primary">
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-brand-dark uppercase tracking-widest">Güvenli Alan</span>
                <span className="text-[11px] font-medium text-brand-dark/50">Yargılanmadan Öğren</span>
              </div>
            </motion.div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}

// --- SEC 3: WHY ZÜMRA ---
function WhyZumra() {
  return (
    <section id="neden-biz" className="py-16 lg:py-24 bg-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-brand-muted/5 via-white to-white -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-2xl mx-auto mb-12 lg:mb-20"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-rosmatika font-medium text-brand-dark mb-6">Geleneksel kursları unutun.</h2>
          <p className="text-lg text-brand-dark/70 font-neubau">
            Zümra Akademi&apos;de eğitim yolculuğu teknik bir zorunluluk değil, güvenli ve keyifli bir kişisel gelişim serüvenidir.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="md:col-span-2 bg-[#FCFCFD] rounded-[2rem] lg:rounded-[2.5rem] p-6 sm:p-8 lg:p-12 border border-black/[0.03] premium-shadow flex flex-col justify-between hover:bg-white transition-colors"
          >
            <div className="w-16 h-16 rounded-2xl bg-brand-primary/5 text-brand-primary flex items-center justify-center mb-8 glow-effect">
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-2xl lg:text-3xl font-rosmatika font-medium text-brand-dark mb-4">Kadınlara Özel Güvenli Alan</h3>
              <p className="text-brand-dark/70 text-lg leading-relaxed max-w-xl font-neubau">
                Kendini rahat hissedeceğin, yargılanmadan öğrenebileceğin 
                sadece kadınlara özel online bir eğitim ortamı. Özgüvenini 
                inşa ederken asla stres yaşamayacaksın.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="md:col-span-1 bg-brand-primary rounded-[2rem] lg:rounded-[2.5rem] p-6 sm:p-8 lg:p-12 shadow-2xl shadow-brand-primary/30 flex flex-col justify-between text-white relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="w-16 h-16 rounded-2xl bg-white/10 text-white flex items-center justify-center mb-8 backdrop-blur-md">
              <Clock className="w-8 h-8" />
            </div>
            <div className="relative z-10">
              <h3 className="text-2xl lg:text-3xl font-rosmatika font-medium mb-4">Esnek Saatler</h3>
              <p className="text-white/80 leading-relaxed font-neubau">
                Kendi evinden, istediğin zaman diliminde katıl. Kamerasız katılım seçeneği ile hayatına %100 uyum sağlar.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="md:col-span-3 bg-white rounded-[2rem] lg:rounded-[2.5rem] p-6 sm:p-8 lg:p-12 border border-black/[0.03] premium-shadow flex flex-col md:flex-row items-center gap-8 lg:gap-12 group"
          >
            <div className="flex-1">
              <div className="w-16 h-16 rounded-2xl bg-brand-muted/10 text-brand-muted flex items-center justify-center mb-8 group-hover:bg-brand-muted/20 transition-colors">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-2xl lg:text-3xl font-rosmatika font-medium text-brand-dark mb-4">Konuşma Odaklı Aktif Pratik</h3>
              <p className="text-brand-dark/70 text-lg leading-relaxed font-neubau">
                Gramer kurallarına boğulmadan, doğrudan iletişim yeteneklerinizi geliştiren dersler. Küçük gruplar ve birebir destek ile dili sadece öğrenmez, yaşarsınız.
              </p>
            </div>
            <div className="flex-1 w-full flex justify-center">
               <div className="w-full max-w-md h-56 bg-[#FCFCFD] rounded-3xl border border-black/5 p-8 flex flex-col justify-center gap-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-brand-primary/5 rounded-bl-full transition-transform duration-700 group-hover:scale-110" />
                  <div className="w-3/4 h-3 bg-brand-dark/5 rounded-full" />
                  <div className="w-1/2 h-3 bg-brand-dark/5 rounded-full" />
                  <div className="w-5/6 h-3 bg-brand-muted/30 rounded-full relative overflow-hidden">
                    <motion.div 
                      className="absolute inset-0 bg-brand-muted"
                      initial={{ x: "-100%" }}
                      whileInView={{ x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                    />
                  </div>
               </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// --- SEC 4: HOW IT WORKS ---
function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Ön Kayıt & İlk Temas',
      desc: 'Formu doldurun. En geç 24 saat içerisinde size ulaşıp süreci planlayalım.'
    },
    {
      num: '02',
      title: 'Ücretsiz Seviye Tespiti',
      desc: 'Mevcut durumunuzu analiz etmek için 15 dakikalık kısa, stressiz bir değerlendirme.'
    },
    {
      num: '03',
      title: 'Size Özel Program',
      desc: 'Hedefinize ve seviyenize en uygun yol haritasını birlikte belirliyoruz.'
    },
    {
      num: '04',
      title: 'Derslere Başlayın',
      desc: 'Esnek saatlerde, güvenli platformlar üzerinden canlı derslere katılın.'
    },
    {
      num: '05',
      title: 'İlerleme Takibi',
      desc: 'Her ay gelişim raporu alarak motivasyonunuzu yüksek tutuyoruz.'
    }
  ];

  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start center", "end center"]
  });

  return (
    <section id="nasil-calisiyoruz" className="py-16 lg:py-24 bg-[#F8F5FC] border-y border-brand-primary/[0.03] overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <motion.div
           initial={{ opacity: 0, x: -30 }}
           whileInView={{ opacity: 1, x: 0 }}
           viewport={{ once: true, margin: "-100px" }}
           transition={{ duration: 0.8 }}
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-rosmatika font-medium text-brand-dark mb-6">Net, planlı ve <span className="italic text-brand-muted">şeffaf</span> bir süreç.</h2>
          <p className="text-lg text-brand-dark/70 mb-10 max-w-md font-neubau">
            İlk günden itibaren ne beklemeniz gerektiğini bilirsiniz. Sürpriz yok, sadece hedefe yönelik adımlar.
          </p>
          <button className="px-8 py-4 rounded-full bg-brand-dark text-white text-xs font-bold uppercase tracking-wider hover:bg-brand-primary transition-colors premium-shadow">
            Hemen Maceraya Başla
          </button>
        </motion.div>

        <div ref={ref} className="relative pl-2 sm:pl-4 lg:pl-12 py-4 lg:py-8">
          {/* Timeline background line */}
          <div className="absolute left-[38px] lg:left-[70px] top-12 bottom-12 w-px bg-brand-dark/5" />
          
          {/* Animated fill line */}
          <motion.div 
            className="absolute left-[38px] lg:left-[70px] top-12 bottom-12 w-[3px] bg-brand-primary origin-top rounded-full"
            style={{ scaleY: scrollYProgress }}
          />

          {steps.map((step, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              className="flex gap-5 sm:gap-8 pb-10 lg:pb-14 relative group"
            >
              <div className="flex flex-col items-center relative z-10 pt-1">
                <motion.div 
                  initial={{ scale: 0.8, backgroundColor: '#ffffff', color: '#533089' }}
                  whileInView={{ scale: 1, backgroundColor: '#533089', color: '#ffffff' }}
                  viewport={{ once: true, margin: "-150px" }}
                  transition={{ delay: i * 0.2 + 0.3, duration: 0.5 }}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-brand-primary shadow-xl shadow-brand-primary/20 flex items-center justify-center font-bold text-base sm:text-lg"
                >
                  {step.num}
                </motion.div>
              </div>
              <div className="pt-2">
                <h3 className="text-xl font-rosmatika font-medium text-brand-dark mb-3 group-hover:text-brand-primary transition-colors">{step.title}</h3>
                <p className="text-brand-dark/60 leading-relaxed font-neubau text-[15px]">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- SEC 5: LANGUAGES ---
function LanguagesGrid() {
  const languages = [
    { name: 'İngilizce', subtitle: 'Genel & Akademik', symbol: 'A' },
    { name: 'Arapça', subtitle: 'Modern & Pratik', symbol: 'ع' },
    { name: 'Fransızca', subtitle: 'Avrupa Dilleri', symbol: 'Fr' },
    { name: 'Almanca', subtitle: 'Kariyer & Eğitim', symbol: 'De' },
    { name: 'Farsça', subtitle: 'Kültürel Derinlik', symbol: 'ف' },
    { name: 'Japonca', subtitle: 'Uzak Doğu', symbol: 'あ' },
    { name: 'Korece', subtitle: 'Yeni Trend', symbol: '가' },
    { name: 'Rusça', subtitle: 'Stratejik İletişim', symbol: 'Ж' }
  ];

  return (
    <section className="py-16 lg:py-24 bg-white relative" id="programlar">
      <div className="absolute top-0 right-0 w-[min(600px,120vw)] h-[min(600px,120vw)] bg-brand-primary/5 rounded-full blur-[100px] -z-10" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 lg:mb-16 gap-6"
        >
          <div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-rosmatika font-medium text-brand-dark mb-4">Sana uygun dili seç.</h2>
            <p className="text-lg text-brand-dark/70 font-neubau">8 farklı dilde, birebir ve grup katılım seçenekleriyle.</p>
          </div>
          <button className="text-brand-primary font-bold uppercase tracking-widest text-xs flex items-center gap-3 hover:gap-4 transition-all">
            Tüm Programları Gör <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
          {languages.map((lang, idx) => (
            <motion.a
              href="#"
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: idx * 0.05, duration: 0.5 }}
              whileHover={{ y: -6, scale: 1.02 }}
              className="group block p-6 lg:p-8 rounded-[2rem] bg-white border border-black/[0.03] premium-shadow hover:shadow-2xl transition-all duration-300 relative overflow-hidden"
            >
              <div className="absolute -right-10 -bottom-10 text-[160px] leading-none font-rosmatika text-brand-muted/[0.03] group-hover:text-brand-primary/[0.05] transition-colors duration-500 select-none pointer-events-none group-hover:rotate-12">
                {lang.symbol}
              </div>
              
              <div className="w-14 h-14 rounded-2xl bg-brand-primary/5 flex items-center justify-center text-brand-primary mb-8 lg:mb-12 group-hover:bg-brand-primary group-hover:text-white transition-colors duration-500 relative z-10 shadow-sm">
                <span className="font-rosmatika text-2xl drop-shadow-sm">{lang.symbol}</span>
              </div>
              <h4 className="text-xl font-rosmatika font-medium text-brand-dark mb-2 relative z-10">{lang.name}</h4>
              <p className="text-sm text-brand-dark/60 font-neubau relative z-10">{lang.subtitle}</p>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- SEC 6: FEATURED PROGRAMS ---
function FeaturedPrograms() {
  const progs = [
    {
      title: 'Genel İngilizce',
      level: 'A1 - C1 Seviyeleri',
      desc: 'Günlük hayatta özgüvenle konuşmak isteyenler için tasarlandı. Pratik odaklı.',
      icon: <MessageSquare className="w-6 h-6" />,
      popular: true
    },
    {
      title: 'Akademik İngilizce',
      level: 'IELTS / TOEFL Hazırlık',
      desc: 'Üniversite hayatı ve sınavlar için akademik makale ve sunum teknikleri.',
      icon: <BookMarked className="w-6 h-6" />,
      popular: false
    },
    {
      title: 'İngilizce Konuşma Kulübü',
      level: 'Haftalık Pratik',
      desc: 'Sosyal bir ortamda aktif pratik yaparak dil becerinizin körelmesini engelleyin.',
      icon: <Headset className="w-6 h-6" />,
      popular: false
    },
    {
      title: 'Mesleki İngilizce',
      level: 'Profesyonel İletişim',
      desc: 'İş hayatında e-posta yazımı, sunum ve toplantı yönetimi becerilerini geliştir.',
      icon: <Briefcase className="w-6 h-6" />,
      popular: false
    }
  ];

  return (
    <section className="py-16 lg:py-24 bg-[#F8F5FC] border-t border-brand-primary/[0.03]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
         <motion.h2 
           initial={{ opacity: 0, y: 20 }}
           whileInView={{ opacity: 1, y: 0 }}
           viewport={{ once: true }}
           className="text-3xl sm:text-4xl font-rosmatika font-medium text-brand-dark mb-10 lg:mb-16 text-center"
         >
           Öne Çıkan Eğitim Modelleri
         </motion.h2>
         
         <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-8">
            {progs.map((prog, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                className="bg-white rounded-[2rem] p-6 lg:p-8 border border-black/[0.03] premium-shadow hover:shadow-2xl transition-shadow flex flex-col group relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-8">
              <div className="w-14 h-14 rounded-2xl bg-[#F8F5FC] border border-black/[0.03] flex items-center justify-center text-brand-primary group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 shadow-sm">
                      {prog.icon}
                   </div>
                   {prog.popular && (
                     <span className="px-3 py-1.5 bg-brand-primary/10 text-brand-primary text-[10px] font-bold uppercase tracking-widest rounded-full">Popüler</span>
                   )}
                </div>
                <h4 className="text-2xl font-rosmatika font-medium text-brand-dark mb-2">{prog.title}</h4>
                <p className="text-[10px] font-bold text-brand-muted mb-4 uppercase tracking-widest">{prog.level}</p>
                <p className="text-sm text-brand-dark/60 font-neubau leading-relaxed mb-8 flex-grow">{prog.desc}</p>
                
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3.5 rounded-xl bg-[#FCFCFD] border border-black/5 text-xs font-bold uppercase tracking-wider hover:bg-brand-primary hover:text-white transition-colors text-brand-dark mt-auto"
                >
                  Bilgi Al
                </motion.button>
              </motion.div>
            ))}
         </div>
      </div>
    </section>
  );
}

// --- SEC 7: CTA / CONSULTATION ---
function ConsultationCTA() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const handleMouseMove = React.useCallback(
    ({ currentTarget, clientX, clientY }: React.MouseEvent) => {
      const { left, top } = currentTarget.getBoundingClientRect();
      mouseX.set(clientX - left);
      mouseY.set(clientY - top);
    },
    [mouseX, mouseY]
  );

  return (
    <section className="py-16 lg:py-24 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div 
          onMouseMove={handleMouseMove}
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="bg-brand-dark text-white rounded-[2rem] lg:rounded-[3rem] p-8 sm:p-12 lg:p-24 relative overflow-hidden text-center shadow-2xl shadow-brand-dark/30 border border-brand-primary/20 group hover:shadow-brand-primary/10 transition-shadow duration-700"
        >
          {/* Interactive Mouse Glow */}
          <motion.div
            className="pointer-events-none absolute -inset-px rounded-[2rem] lg:rounded-[3rem] opacity-0 transition-opacity duration-300 group-hover:opacity-100 mix-blend-screen"
            style={{
              background: useMotionTemplate`
                radial-gradient(
                  600px circle at ${mouseX}px ${mouseY}px,
                  rgba(182, 107, 248, 0.15),
                  transparent 80%
                )
              `,
            }}
          />

          {/* Abstract elegant glow with ambient movement */}
          <motion.div 
            animate={{ scale: [1, 1.1, 1], rotate: [0, 45, 0] }}
            transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(800px,140vw)] h-[min(800px,140vw)] bg-brand-primary/30 rounded-full blur-[100px] mix-blend-screen pointer-events-none opacity-50 group-hover:opacity-80 transition-opacity duration-1000" 
          />
          
          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl lg:text-6xl font-rosmatika font-medium mb-8 leading-[1.1]">
              Hangi programın size uygun olduğundan emin değil misiniz?
            </h2>
            <p className="text-lg lg:text-xl text-white/70 font-neubau mb-12 leading-relaxed max-w-2xl mx-auto">
              Uzman danışmanlarımızla yapacağınız kısa ve ücretsiz bir görüşme sonucunda, sadece size özel bir rota çıkartalım. 
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="h-14 px-6 sm:px-10 rounded-[1rem] bg-white text-brand-dark font-bold uppercase tracking-wider text-xs shadow-2xl glow-effect"
              >
                Ücretsiz Randevu Oluştur
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' }}
                whileTap={{ scale: 0.95 }}
                className="h-14 px-6 sm:px-10 rounded-[1rem] bg-white/5 text-white font-bold uppercase tracking-wider text-xs border border-white/20 flex items-center justify-center gap-3 transition-colors"
              >
                WhatsApp&apos;tan Yaz <ArrowRight className="w-4 h-4"/>
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// --- SEC 7.5: INSTRUCTORS TEASER ---
function InstructorsTeaser() {
  return (
    <section className="py-16 lg:py-24 bg-white relative border-t border-black/[0.02] overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-center">
           <motion.div 
             initial={{ opacity: 0, x: -30 }}
             whileInView={{ opacity: 1, x: 0 }}
             viewport={{ once: true, margin: "-100px" }}
             transition={{ duration: 0.8 }}
           >
             <h2 className="text-3xl sm:text-4xl lg:text-5xl font-rosmatika font-medium text-brand-dark mb-6">İlham veren, güçlü kadınlardan<br/>oluşan eğitim kadrosu.</h2>
             <p className="text-lg text-brand-dark/70 font-neubau mb-10 max-w-xl">
               Her biri kendi alanında uzman, akademik kariyere sahip elit eğitmenlerimizle tanışın. Size sadece dil öğretmiyorlar, aynı zamanda mentorluk yapıyorlar.
             </p>
             <button className="text-brand-primary font-bold uppercase tracking-widest text-xs flex items-center gap-3 hover:gap-4 transition-all">
               Tüm Kadroyu Gör <ArrowRight className="w-4 h-4" />
             </button>
           </motion.div>

           <motion.div 
             initial={{ opacity: 0, scale: 0.95 }}
             whileInView={{ opacity: 1, scale: 1 }}
             viewport={{ once: true, margin: "-100px" }}
             transition={{ duration: 0.8 }}
             className="relative w-full h-[320px] sm:h-[400px] lg:h-[500px]"
           >
              {/* Stacked images effect */}
              <div className="absolute inset-0 right-4 bottom-4 sm:right-10 sm:bottom-10 rounded-[2rem] lg:rounded-[2.5rem] overflow-hidden premium-shadow z-20 border border-white">
                <Image src="https://picsum.photos/seed/instructor1/600/800" alt="Instructor" fill className="object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="absolute inset-0 left-4 top-4 sm:left-10 sm:top-10 rounded-[2rem] lg:rounded-[2.5rem] overflow-hidden premium-shadow z-10 border border-white opacity-80 rotate-6">
                <Image src="https://picsum.photos/seed/instructor2/600/800" alt="Instructor" fill className="object-cover grayscale" referrerPolicy="no-referrer" />
              </div>
           </motion.div>
        </div>
      </div>
    </section>
  )
}

// --- SEC 8: TESTIMONIALS ---
function Testimonials() {
  const reviews = [
    { name: "Elif A.", program: "Speaking Programı", image: 1, text: "Kamerayı açmadan rahat hissetmem benim için çok önemliydi. Derslerde konuşmaya gerçekten cesaretim geldi ve özgüvenim arttı." },
    { name: "Selin K.", program: "Genel İngilizce", image: 2, text: "Planlı ilerliyoruz, her ay net geri bildirim alıyorum. Ne yaptığımı bildiğim için motivasyonum hiç düşmüyor." },
    { name: "Hande N.", program: "Sınav Hazırlık", image: 3, text: "Hocam eksiklerimi çok hızlı fark etti. Deneme analiz sistemi sayesinde hedefime daha yakın ve güçlü hissediyorum." },
    { name: "Nil T.", program: "Arapça Konuşma", image: 4, text: "Dersler çok akıcı. Hedefime göre içerik verildi, kısa sürede konuşma alışkanlığı kazandım. En iyisi Zümra." }
  ];

  return (
    <section id="yorumlar" className="py-16 lg:py-24 bg-[#F8F5FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl sm:text-4xl lg:text-5xl font-rosmatika font-medium text-brand-dark mb-10 lg:mb-16 text-center"
        >
          Öğrencilerimiz Neler Diyor?
        </motion.h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
           {reviews.map((rev, i) => (
             <motion.div 
               key={i}
               initial={{ opacity: 0, y: 30 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true, margin: "-50px" }}
               transition={{ delay: i * 0.15, duration: 0.6 }}
               className="bg-white border border-black/[0.03] premium-shadow rounded-[2rem] p-6 lg:p-8 flex flex-col hover:-translate-y-3 transition-transform duration-500 glow-effect"
             >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, idx) => (
                       <Star key={idx} className="w-4 h-4 text-brand-muted fill-brand-muted/20"/>
                    ))}
                  </div>
                  <div className="text-[100px] font-rosmatika leading-none text-brand-primary/5 -mt-8 select-none">&quot;</div>
                </div>
                <p className="text-brand-dark/80 font-neubau text-[15px] leading-relaxed mb-10 flex-grow italic">
                  &quot;{rev.text}&quot;
                </p>
                <div className="pt-6 border-t border-black/[0.03] mt-auto flex items-center gap-4">
                   <div className="w-12 h-12 rounded-full overflow-hidden relative bg-brand-muted/10 border border-black/5">
                     <Image src={`https://picsum.photos/seed/student${rev.image}/100/100`} alt={rev.name} fill className="object-cover" referrerPolicy="no-referrer" />
                   </div>
                   <div>
                     <div className="font-bold text-brand-dark uppercase tracking-widest text-xs mb-1">{rev.name}</div>
                     <div className="text-[10px] uppercase font-bold tracking-widest text-brand-muted">{rev.program}</div>
                   </div>
                </div>
             </motion.div>
           ))}
        </div>
      </div>
    </section>
  )
}

// --- SEC 9: FAQ ---
function FAQ() {
  const faqs = [
    {
      q: "Ücretsiz dersleriniz var mı?",
      a: "Evet, var. Her ay, grup derslerimizi denemek isteyenler için ücretsiz demo dersler sunuyoruz. Ayrıca motivasyonu artırmak için seminerler düzenliyoruz."
    },
    {
      q: "Ders materyalleri nasıl sağlanıyor?",
      a: "Tüm materyaller online platformumuzda sunulur. Günlük yaşam ve iş hayatına uygun, pratik ve interaktif içeriklerle öğrenme sürecinizi destekleriz."
    },
    {
      q: "Dersler hangi platformda yapılıyor?",
      a: "Dersler Zoom veya Google Meet üzerinden canlı ve etkileşimli olarak gerçekleşir. Sadece bilgisayar veya tablet yeterlidir."
    },
    {
      q: "Kamerasız katılım mümkün mü?",
      a: "Kesinlikle! Kadınların tamamen rahat hissetmesi adına, dileyen öğrencilerimiz derslere sadece sesli olarak katılabilirler."
    }
  ];

  return (
    <section id="sss" className="py-16 lg:py-24 bg-[#F8F5FC] border-t border-brand-primary/[0.03]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 lg:mb-16"
        >
           <h2 className="text-3xl sm:text-4xl font-rosmatika font-medium text-brand-dark mb-4">Aklınıza takılanları netleştirelim.</h2>
           <p className="text-brand-dark/60 font-neubau">Daha fazla soru için WhatsApp iletişim hattımızdan çekinmeden bize yazabilirsiniz.</p>
        </motion.div>
        
        <div className="space-y-4">
          {faqs.map((faq, i) => (
             <AccordionItem key={i} question={faq.q} answer={faq.a} delay={i * 0.1}/>
          ))}
        </div>
      </div>
    </section>
  )
}

function AccordionItem({ question, answer, delay }: { question: string, answer: string, delay: number }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: delay, duration: 0.5 }}
      className="bg-[#FCFCFD] border border-black/[0.03] shadow-sm rounded-[1.5rem] overflow-hidden transition-all hover:shadow-md mt-4"
    >
       <button 
          onClick={() => setIsOpen(!isOpen)} 
          className="w-full px-5 sm:px-8 py-5 sm:py-6 flex justify-between items-center text-left"
       >
          <span className="font-rosmatika font-medium text-brand-dark text-lg md:text-xl pr-4">{question}</span>
          <span className={`transform transition-transform duration-300 shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-white border border-black/5 ${isOpen ? 'rotate-45' : ''}`}>
             <Plus className="w-5 h-5 text-brand-primary" />
          </span>
       </button>
       <div className={`grid transition-all duration-400 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
             <div className="px-5 sm:px-8 pb-6 sm:pb-8 text-brand-dark/70 font-neubau leading-relaxed">
               {answer}
             </div>
          </div>
       </div>
    </motion.div>
  )
}

// --- SEC 10: FOOTER ---
function Footer() {
  return (
    <footer className="bg-white border-t border-black/5 pt-16 lg:pt-24 pb-12 relative overflow-hidden">
       <div className="absolute top-0 right-0 w-[min(800px,140vw)] h-[min(800px,140vw)] bg-brand-muted/5 rounded-full blur-[120px] -z-10" />
       
       <div className="max-w-7xl mx-auto px-4 sm:px-6 grid sm:grid-cols-2 md:grid-cols-4 gap-10 lg:gap-12 mb-14 lg:mb-20 relative z-10">
          <div className="md:col-span-1">
             <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-[10px] bg-brand-primary flex items-center justify-center text-white font-bold premium-shadow">Z</div>
                <span className="font-rosmatika font-bold tracking-tight text-2xl text-brand-dark">ZÜMRA<span className="font-neubau text-[10px] uppercase font-bold tracking-widest text-brand-muted ml-1">Akademi</span></span>
             </div>
             <p className="text-sm font-neubau text-brand-dark/60 leading-relaxed">
               Türkiye&apos;nin kadınlara özel online ilk dil akademisi. Kendi hızında öğren, hedefine ulaş, dünyayla konuş.
             </p>
          </div>
          <div>
            <h4 className="font-bold font-neubau text-[11px] uppercase tracking-widest text-brand-dark mb-6">Programlar</h4>
            <ul className="space-y-4 text-[14px] font-neubau text-brand-dark/70">
              <li><a href="#" className="hover:text-brand-primary transition-colors">Genel İngilizce</a></li>
              <li><a href="#" className="hover:text-brand-primary transition-colors">Akademik İngilizce</a></li>
              <li><a href="#" className="hover:text-brand-primary transition-colors">Konuşma Kulüpleri</a></li>
              <li><a href="#" className="hover:text-brand-primary transition-colors">Mesleki İngilizce</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold font-neubau text-[11px] uppercase tracking-widest text-brand-dark mb-6">Kurumsal</h4>
            <ul className="space-y-4 text-[14px] font-neubau text-brand-dark/70">
              <li><a href="#" className="hover:text-brand-primary transition-colors">Hakkımızda</a></li>
              <li><a href="#neden-biz" className="hover:text-brand-primary transition-colors">Neden Biz?</a></li>
              <li><a href="#" className="hover:text-brand-primary transition-colors">Eğitmenler</a></li>
              <li><a href="#" className="hover:text-brand-primary transition-colors">İletişim</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold font-neubau text-[11px] uppercase tracking-widest text-brand-dark mb-6">Destek</h4>
            <ul className="space-y-4 text-[14px] font-neubau text-brand-dark/70">
              <li><a href="#sss" className="hover:text-brand-primary transition-colors">Sıkça Sorulan Sorular</a></li>
              <li><a href="#" className="hover:text-brand-primary transition-colors">Gizlilik Politikası</a></li>
              <li><a href="#" className="hover:text-brand-primary transition-colors">Kullanım Şartları</a></li>
            </ul>
          </div>
       </div>
       <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 border-t border-black/5 flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <p className="text-[13px] font-neubau text-brand-dark/50">© {new Date().getFullYear()} Zümra Akademi. Tüm hakları saklıdır.</p>
          <div className="flex gap-4">
             {/* Social Links Mocks */}
             <div className="w-10 h-10 rounded-full bg-[#FCFCFD] border border-black/5 flex items-center justify-center text-brand-dark/50 hover:bg-brand-primary/5 hover:text-brand-primary cursor-pointer transition-colors" />
             <div className="w-10 h-10 rounded-full bg-[#FCFCFD] border border-black/5 flex items-center justify-center text-brand-dark/50 hover:bg-brand-primary/5 hover:text-brand-primary cursor-pointer transition-colors" />
          </div>
       </div>
    </footer>
  )
}
