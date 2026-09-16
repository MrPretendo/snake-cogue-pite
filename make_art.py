import os

b64 = open('cover_b64.txt', 'r', encoding='utf-8').read().strip()
art_dir = r'C:\Users\Alear\.gemini\antigravity\brain\b2052325-409a-4f57-bee5-1f508c44c59a'
os.makedirs(art_dir, exist_ok=True)
dest = os.path.join(art_dir, 'cover_viewer.html')

html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=Saira:wght@500;600&display=swap');
    body {{ font-family: 'Saira', sans-serif; }}
    .font-mono-tech {{ font-family: 'Chakra Petch', monospace; }}
  </style>
</head>
<body class="bg-transparent text-[var(--foreground)] antialiased p-3">
  <div class="bg-[#05070D] text-[#E8EEF7] border border-[#00E5FF]/30 rounded-xl p-4 shadow-2xl max-w-[660px] mx-auto">
    <!-- Cabecera -->
    <div class="flex items-center justify-between border-b border-[#16233A] pb-3 mb-3">
      <div>
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]"></span>
          <h2 class="font-mono-tech font-bold text-base text-[#00E5FF] tracking-wider uppercase">Cover para itch.io (630×500)</h2>
        </div>
        <p class="text-[#5B6B84] text-xs font-mono-tech mt-0.5">Formato oficial recomendado para la ficha y catálogo de itch.io</p>
      </div>
      <span class="px-2.5 py-1 text-xs font-mono-tech rounded bg-[#FFB300]/10 text-[#FFC107] border border-[#FFB300]/40 font-semibold">
        630 × 500 px
      </span>
    </div>

    <!-- Imagen Preview -->
    <div class="relative rounded-lg overflow-hidden border border-[#00E5FF]/20 bg-[#05070D] flex items-center justify-center shadow-inner group">
      <img id="coverImg" src="data:image/png;base64,{b64}" alt="Snake Cogue Pite Cover" class="w-full h-auto max-w-[630px] rounded object-contain transition-transform duration-300 group-hover:scale-[1.01]" />
    </div>

    <!-- Acciones e Info -->
    <div class="mt-3 flex flex-wrap items-center justify-between gap-3 pt-1">
      <div class="text-xs text-[#5B6B84] font-mono-tech flex items-center gap-2">
        <span class="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
        <span>Guardado como <strong class="text-[#E8EEF7]">cover.png</strong> y <strong class="text-[#E8EEF7]">promo/cover.png</strong></span>
      </div>
      <button onclick="descargarCover()" class="px-4 py-2 bg-[#00E5FF] hover:bg-[#33ECFF] text-[#05070D] font-mono-tech font-bold text-xs uppercase tracking-wider rounded-lg shadow-[0_0_15px_rgba(0,229,255,0.4)] transition-all flex items-center gap-2 active:scale-95 cursor-pointer">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Descargar PNG (630×500)
      </button>
    </div>
  </div>

  <script>
    function descargarCover() {{
      const link = document.createElement('a');
      link.download = 'snake-cogue-pite-cover-630x500.png';
      link.href = document.getElementById('coverImg').src;
      link.click();
    }}
  </script>
</body>
</html>"""

with open(dest, 'w', encoding='utf-8') as f:
    f.write(html)
print('Cover viewer artifact successfully created at:', dest)
