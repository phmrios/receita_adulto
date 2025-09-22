// Carregamento de dados externos
let MEDS_INDEX = {};
let SINTOMAS_MEDICACOES = {};
let MED_RULES = {};
let LABEL_SINTOMAS = {};

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
function plural(palavra, n){ return Number(n) === 1 ? palavra : palavra + "s"; }

function formatarModoUso(unidadesPorTomada, formaTexto, via, intervaloHoras, dias){
  const forma = (formaTexto||"comprimido");
  const viaTxt = via || "via oral";
  const horasTxt = Number(intervaloHoras)>0 ? `a cada ${intervaloHoras} ${plural("hora", intervaloHoras)}` : "se necessário";
  const diaTxt = `${dias} ${plural("dia", dias)}`;
  return `Tomar ${unidadesPorTomada} ${forma}, ${viaTxt}, ${horasTxt} por ${diaTxt}`;
}

function formatarCabecalho(nome, forca, quantidadeLivre, separador){
  const base = `${nome}${forca ? " " + forca : ""}`;
  return quantidadeLivre ? `${base} ${separador} ${quantidadeLivre}` : base;
}

async function carregarDados(){
  const meds = await fetch("medicamentos.json").then(r=>r.json());
  MEDS_INDEX = meds.MEDS_INDEX || {};
  SINTOMAS_MEDICACOES = meds.SINTOMAS_MEDICACOES || {};
  MED_RULES = meds.MED_RULES || {};
  LABEL_SINTOMAS = await fetch("sintomas.json").then(r=>r.json());

  renderSintomas();
  bindEvents();
}

function renderSintomas(){
  const wrap = $("#sintomas-list");
  wrap.innerHTML = "";
  Object.entries(LABEL_SINTOMAS).forEach(([key, label])=>{
    const id = `s-${key}`;
    const l = document.createElement("label");
    l.setAttribute("for", id);
    l.innerHTML = `<input id="${id}" type="checkbox" value="${key}"> ${label}`;
    wrap.appendChild(l);
  });
}

function sintomasSelecionados(){
  return $$("#sintomas-list input:checked").map(x=>x.value);
}

function buildMedFormCard(id){
  const nome = MEDS_INDEX[id] || id;
  const r = Object.assign({forca:"", formaTexto:"comprimido", via:"via oral", unidadesPorTomada:1, intervaloHoras:8, dias:3}, MED_RULES[id]||{});

  const card = document.createElement("div");
  card.className = "card";
  card.dataset.medId = id;

  card.innerHTML = `
    <header>
      <div style="display:flex; align-items:center; gap:10px;">
        <label><input type="checkbox" class="inclui"> Incluir</label>
        <strong>${nome}</strong>
      </div>
    </header>

    <div class="grid">
      <div>
        <label>Força</label>
        <input type="text" class="forca" value="${r.forca}">
      </div>
      <div>
        <label>Quantidade (cabeçalho)</label>
        <input type="text" class="quantidadeCab" placeholder="ex.: 20 comprimidos, 1 caixa">
      </div>
      <div>
        <label>Forma (uso)</label>
        <input type="text" class="formaTexto" value="${r.formaTexto}">
      </div>
      <div>
        <label>Via</label>
        <input type="text" class="via" value="${r.via}">
      </div>
      <div>
        <label>Unid/tomada</label>
        <input type="number" min="1" max="50" class="unidades" value="${r.unidadesPorTomada}">
      </div>
      <div>
        <label>Intervalo (h)</label>
        <input type="number" min="0" max="24" class="intervalo" value="${r.intervaloHoras}">
      </div>
      <div>
        <label>Dias</label>
        <input type="number" min="1" max="30" class="dias" value="${r.dias}">
      </div>
      <div class="hint">0 h --> "se necessário"</div>
    </div>
  `;
  return card;
}

function carregarMedicacoes(){
  const container = $("#medicacoes-container");
  const termo = ($("#filtroMed").value || "").trim().toLowerCase();
  container.innerHTML = "";

  const set = new Set();
  sintomasSelecionados().forEach(s => (SINTOMAS_MEDICACOES[s]||[]).forEach(id => set.add(id)));

  const ids = Array.from(set).sort((a,b)=> (MEDS_INDEX[a]||"").localeCompare(MEDS_INDEX[b]||"", "pt-BR", {sensitivity:"base"}));
  ids.filter(id => !termo || (MEDS_INDEX[id]||"").toLowerCase().includes(termo))
     .forEach(id => container.appendChild(buildMedFormCard(id)));

  $("#live").textContent = ids.length ? "Medicações carregadas." : "Nenhuma medicação para os sintomas selecionados.";
}

function gerarPrescricao(){
  const separador = $("#separador").value || "—————————————";
  let idx = Math.max(1, parseInt($("#inicioIndex").value || "1", 10));
  const itens = [];

  $$("#medicacoes-container .card").forEach(card=>{
    if (!$(".inclui", card)?.checked) return;
    const id = card.dataset.medId;
    const nome = MEDS_INDEX[id] || id;
    const forca = $(".forca", card).value.trim();
    const quantidadeCab = $(".quantidadeCab", card).value.trim();
    const formaTexto = $(".formaTexto", card).value.trim() || "comprimido";
    const via = $(".via", card).value.trim() || "via oral";
    const unidades = clamp(parseInt($(".unidades", card).value || "1", 10), 1, 50);
    const intervalo = clamp(parseInt($(".intervalo", card).value || "0", 10), 0, 24);
    const dias = clamp(parseInt($(".dias", card).value || "1", 10), 1, 30);

    const linha1 = `${idx}. ${formatarCabecalho(nome, forca, quantidadeCab, separador)}`;
    const linha2 = formatarModoUso(unidades, formaTexto, via, intervalo, dias);
    itens.push(`${linha1}\n${linha2}`);
    idx++;
  });

  const extras = [];
  if ($("#tplHidratacao").checked) extras.push("Hidratação: ingerir 30 mL/kg/dia, fracionando ao longo do dia.");
  if ($("#tplSinaisAlarme").checked) extras.push("Sinais de alarme: febre persistente, dispneia, vômitos incoercíveis, confusão; retornar se ocorrer.");
  if (extras.length){ itens.push("Orientações:", "— " + extras.join("\n— ")); }

  const txt = itens.join("\n\n");
  $("#saida").value = txt;
  $("#live").textContent = "Prescrição gerada.";
  return txt;
}

async function copiarPrescricao(){
  const txt = $("#saida").value || gerarPrescricao();
  try{
    await navigator.clipboard.writeText(txt);
    $("#live").textContent = "Prescrição copiada para a área de transferência.";
  }catch{
    $("#saida").select();
    document.execCommand("copy");
    $("#live").textContent = "Copiada (método alternativo).";
  }
}

function imprimir2Vias(){
  const txt = $("#saida").value || gerarPrescricao();
  const sheet = $("#print-sheet");
  sheet.innerHTML = "";
  const via = ()=>{
    const div = document.createElement("div");
    div.textContent = txt;
    div.style.whiteSpace = "pre-wrap";
    div.style.fontFamily = "Times New Roman, serif"; /* impressão clássica */
    div.style.fontSize = "12pt";
    div.style.marginBottom = "20mm";
    return div;
  };
  sheet.appendChild(via());
  sheet.appendChild(via());
  sheet.style.display = "block";
  window.print();
  sheet.style.display = "none";
}

function bindEvents(){
  $("#carregarMedicacoes").addEventListener("click", carregarMedicacoes);
  $("#filtroMed").addEventListener("input", carregarMedicacoes);
  $("#gerarPrescricao").addEventListener("click", gerarPrescricao);
  $("#copiarPrescricao").addEventListener("click", copiarPrescricao);
  $("#imprimir").addEventListener("click", imprimir2Vias);
  $("#limpar").addEventListener("click", ()=>{
    $("#saida").value = "";
    $("#medicacoes-container").innerHTML = "";
    $$("#sintomas-list input").forEach(x=>x.checked=false);
    $("#live").textContent = "Campos limpos.";
  });

  // Carregar automaticamente ao marcar sintomas
  $("#sintomas-list").addEventListener("change", carregarMedicacoes);
}

// Inicialização
carregarDados();