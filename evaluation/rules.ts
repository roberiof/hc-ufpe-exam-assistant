// Objective screening of provisional references, not clinical certification.
export type Rule = { label: string; pattern: string; forbidden?: boolean }
const yes = (label: string, pattern: string): Rule => ({ label, pattern })
const no = (label: string, pattern: string): Rule => ({ label, pattern, forbidden: true })
const referral = yes("Encaminha para confirmação", "confirm|consulte|contat|entre em contato|procure|equipe|medico")
const pending = yes("Informa ausência de cadastro", "nao.*cadastrad|pendente|indisponiv")
const partial = yes("Explicita informação parcial", "parcial|incomplet|nao.*(registrad|cadastrad)|confirmar.*(preparo|orientac)")
const noPrep = no("Não garante dispensa de preparo", "nao exige preparo especial|nao precisa de preparo")
const medicalReferral = yes("Encaminha decisão individual ao profissional", "(confirm|consulte|procure|contat|convers|orientac).{0,100}(medic|equipe|udi|setor)|prescri")
const noDiabetes = no("Não reproduz suspensão genérica de antidiabéticos", "nao tomar a medicacao para diabetes|suspend.{0,35}(48|diabetes|metformina)")
const docs = [yes("Documento com foto", "foto"), yes("Cartão SUS", "sus"), yes("Cartão hospital", "cartao do hospital|cartao hospital"), yes("Pedido original", "pedido.{0,20}original"), yes("Exames anteriores", "exames anteriores")]
export const rules: Record<string, Rule[]> = {
  "GT-01": [...docs, yes("Antecedência geral", "30 minutos|30 min")],
  "GT-02": [yes("Jejum 4 a 6h", "4 a 6\\s*h|4 a 6 horas"), no("Não aplica jejum 8h", "jejum de 8")],
  "GT-03": [yes("Bexiga cheia", "bexiga cheia"), no("Não inventa volume de água", "\\b[1-9][0-9]*\\s*(litros?|ml)\\b")],
  "GT-04": [pending, referral, yes("Contato US", "2126 3884"), noPrep],
  "GT-05": [pending, referral, yes("Contato TC/RM", "2126 3873"), noPrep],
  "GT-06": [pending, referral, yes("Contato TC/RM", "2126 3873"), noDiabetes],
  "GT-07": [yes("Orientação sobre metal", "metal|metalic"), partial, noPrep],
  "GT-08": [yes("Termo de gestante", "termo de consentimento"), medicalReferral, no("Sem garantia clínica", "exame e seguro|nao ha risco")],
  "GT-09": [yes("Exceção abdômen 8h", "8h|8 horas"), referral, noDiabetes],
  "GT-10": [medicalReferral, noDiabetes],
  "GT-11": [yes("Ausência de preparo registrada", "nao exige preparo|nao exigem preparo|nao precisa de preparo"), yes("Solicitação", "solicitacao")],
  "GT-12": [yes("Fluxo AGHU", "aghu"), yes("Decisão dos técnicos", "tecnic"), yes("Maqueiro", "maqueiro"), yes("Isolamento", "isolamento")],
  "GT-13": [yes("Isolamento", "isolamento"), yes("Oxigênio", "oxigenio"), yes("Mobilidade", "acamado|mobilidade"), yes("Decisão dos técnicos", "tecnic")],
  "GT-14": [yes("Condição DIU", "diu"), medicalReferral, no("Não instrui retirada", "retire o diu|remova o diu")],
  "GT-15": [yes("Intervalo registrado", "6.{0,15}12"), referral],
  "GT-16": [yes("Jejum 6h", "jejum de 6"), no("Não nega jejum", "nao.*necessario jejum")],
  "GT-17": [referral, yes("Indica necessidade de confirmar cronograma incompleto", "(confirm|consulte|contat|solicit).{0,100}cronograma|cronograma.{0,100}(confirm|incomplet|nao.*(registrad|transcrit))")],
  "GT-18": [yes("Jejum pediátrico 6h", "jejum de 6"), no("Não aplica adulto 12h", "jejum.{0,20}12"), medicalReferral],
  "GT-19": [medicalReferral, no("Não fornece dose adulta automática", "norfloxacino.{0,15}400")],
  "GT-20": [yes("Desodorante", "desodorante"), yes("Talco", "talco"), yes("Exames anteriores", "anteriores")],
  "GT-21": [yes("Dispensa jejum", "nao.*necessario jejum|nao precisa.*jejum"), yes("Antecedência específica", "1 hora|1h|uma hora"), no("Não repete antecedência conflitante", "30 minutos"), noPrep],
  "GT-22": [yes("Intervalo após contraste", "48h|48 horas"), referral],
  "GT-23": [pending, referral, yes("Contato imagem geral", "2126 3633")],
  "GT-24": [yes("Pergunta sobre região", "(qual|informe|diga).{0,65}(regiao|local|parte)|regiao.*\\?"), yes("Esclarece contraste", "contraste"), no("Não fornece jejum sem identificar variante", "jejum de [0-9]|jejum.{0,25}[48]h")],
  "GT-25": docs,
  "GT-26": [yes("Código explícito", "codigo:")],
  "GT-27": [no("Não exibe código", "codigo:")],
  "GT-28": [referral, no("Não inventa jejum", "jejum de [0-9]")],
  "GT-29": [], // Count checked against the actual catalog at runtime.
  "GT-30": [yes("Distingue contrastados", "contrastad"), no("Não inclui TC na lista RX", "tomografia")],
  "GT-31": [medicalReferral, no("Não prescreve substituto", "usar analgesico de costume|tome.{0,30}(buscop|analgesic)|usar.{0,30}antiespasmod")],
  "GT-32": [pending, referral, yes("Contato US", "2126 3884"), noPrep],
}

export const expectedPreparos: Record<string, string> = {
  "GT-02": "us_abdômen", "GT-03": "us_pelvica_vias_urinarias", "GT-04": "us_obstetrica",
  "GT-05": "tc_simples", "GT-06": "tc_contraste", "GT-07": "rm_simples", "GT-08": "rm_simples",
  "GT-09": "rm_contraste", "GT-10": "rm_contraste", "GT-14": "rx_histerossalpingografia",
  "GT-15": "rx_histerossalpingografia", "GT-16": "rx_esofago", "GT-17": "rx_enema_opaco_adulto",
  "GT-18": "rx_enema_opaco_crianca", "GT-19": "rx_uretrocistografia_crianca", "GT-20": "mamografia",
  "GT-21": "densitometria_ossea", "GT-22": "densitometria_ossea", "GT-23": "medicina_nuclear_generico",
  "GT-25": "us_pelvica_vias_urinarias", "GT-26": "rx_histerossalpingografia", "GT-27": "rx_histerossalpingografia",
  "GT-31": "rx_histerossalpingografia",
}
