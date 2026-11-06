import {readFileSync,writeFileSync} from 'node:fs'
const read = name => JSON.parse(readFileSync(`evaluation/reports/${name}.json`))
const before=read('pre-composer-fallback'), after=read('fallback')
function check(report,id) {
 const r=report.results.find(c=>c.id===id),t=r.reply
 const common=[{label:'Sem posologia ou suspensão automática',passed:!/[0-9]+\s*(mg|gotas)|deve ser suspensa|nao tomar a medicacao/i.test(t.normalize('NFD').replace(/[\u0300-\u036f]/g,''))}]
 if(id==='GT-02')common.push({label:'Não introduz pré-transplante',passed:!r.sources.some(s=>/transplante/i.test(s.nome))},{label:'Jejum informado uma vez',passed:(t.match(/Jejum de 4 a 6h/g)||[]).length===1})
 if(id==='GT-05')common.push({label:'Explicita dúvida de sedação',passed:/com ou sem sedação/.test(t)},{label:'Não repete protocolos nem linguagem interna',passed:!t.includes('NÃO presuma')&&t.length<600})
 if(id==='GT-21')common.push({label:'Jejum e chegada aparecem uma vez',passed:(t.match(/Não é necessário jejum/g)||[]).length===1&&(t.match(/uma hora/g)||[]).length===1},{label:'Resposta direta sem protocolo extenso',passed:t.length<600&&!/cálcio|48h|24h/.test(t)})
 return {id,checks:common,passed:common.every(c=>c.passed),characters:t.length}
}
const result={version:2,scope:'Qualidade de apresentação dos três exemplos do usuário; não é homologação clínica.',before:['GT-02','GT-05','GT-21'].map(id=>check(before,id)),after:['GT-02','GT-05','GT-21'].map(id=>check(after,id))}
writeFileSync('evaluation/reports/presentation-v2.json',JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify(result,null,2))
if(result.after.some(r=>!r.passed))process.exitCode=1
