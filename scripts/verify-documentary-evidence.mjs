import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
const root=new URL('../',import.meta.url)
const read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'))
const evidence=read('data/documentary-evidence.json'), preparations=read('data/preparos.json').preparos, exams=read('data/exames.json')
const ids=new Set()
for(const fact of evidence.facts){
 if(ids.has(fact.id))throw new Error(`Fato duplicado: ${fact.id}`)
 ids.add(fact.id)
 if(!evidence.sources[fact.sourceId] || fact.validation!=='pending-udi' || !fact.locator || !fact.quote)throw new Error(`Evidência inválida: ${fact.id}`)
 if(!fact.appliesTo.length || fact.appliesTo.some(code=>!exams.some(exam=>exam.sigla===code)))throw new Error(`Aplicação ausente no catálogo: ${fact.id}`)
}
for(const [id,p] of Object.entries(preparations))for(const fact of p.fact_ids??[])if(!ids.has(fact))throw new Error(`Fato ausente: ${id}/${fact}`)
const bindings=read('data/exam-preparation-associations.json').bindings
for(const [key,b] of Object.entries(bindings)){
 const exam=exams.find(e=>`${e.modalidade}:${e.sigla}`===key)
 if(!exam||exam.preparo_id!==b.preparo_id||!preparations[b.preparo_id])throw new Error(`Associação inconsistente: ${key}`)
}
console.log(`Verificado: ${ids.size} fatos, ${Object.keys(bindings).length} associações explícitas; nenhuma homologação clínica.`)
// Optional local source verification: never requires or publishes the original document.
if(process.argv[2]){
 const hash=createHash('sha256').update(readFileSync(process.argv[2])).digest('hex')
 if(hash!==evidence.sources['orientacoes-exames'].sha256)throw new Error('O arquivo não corresponde à versão documental registrada')
 console.log('Hash do documento original conferido.')
}
