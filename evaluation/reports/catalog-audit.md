# Auditoria do catálogo e da ingestão

Relatório determinístico da Task 12 (PRO-10). Os achados de revisão não são erros clínicos confirmados.

## Resumo

- Linhas na fonte: 914
- Exames gerados: 814
- Preparos cadastrados: 23
- Achados bloqueantes: 0
- Itens para revisão da UDI: 28
- Cobertura por status: ok=306, parcial=106, pendente=402, invalid=0

| Classificação | Regra | Quantidade |
| --- | --- | ---: |
| Bloqueante | invalidExams | 0 |
| Bloqueante | invalidPreparations | 0 |
| Bloqueante | missingPreparationReferences | 0 |
| Bloqueante | duplicateRecords | 0 |
| Bloqueante | missingGeneratedEntries | 0 |
| Bloqueante | unexpectedGeneratedEntries | 0 |
| Revisão UDI | sharedCodes | 1 |
| Revisão UDI | duplicateNames | 7 |
| Revisão UDI | orphanPreparations | 2 |
| Revisão UDI | pendingAssociations | 18 |
| Revisão UDI | sourceConflictingNames | 0 |

## Achados bloqueantes

O pipeline deve corrigir estes itens antes de considerar o catálogo estruturalmente íntegro.

```json
{
  "invalidExams": [],
  "invalidPreparations": [],
  "missingPreparationReferences": [],
  "duplicateRecords": [],
  "missingGeneratedEntries": [],
  "unexpectedGeneratedEntries": []
}
```

## Itens para revisão da UDI

Estes itens podem ser legítimos. A equipe técnica apenas os identifica e não decide seu significado clínico.

```json
{
  "sharedCodes": [
    {
      "code": "TCOR",
      "exams": [
        {
          "code": "TCOR",
          "modality": "medicina_nuclear",
          "name": "TC CORAÇÃO - PARA AVALIAÇÃO DO ESCORE DE CÁLCIO CORONARIANO",
          "preparationId": "medicina_nuclear_generico"
        },
        {
          "code": "TCOR",
          "modality": "tomografia_computadorizada",
          "name": "TC CORAÇÃO - PARA AVALIAÇÃO DO ESCORE DE CÁLCIO CORONARIANO",
          "preparationId": "tc_simples"
        }
      ]
    }
  ],
  "duplicateNames": [
    {
      "normalizedName": "abdomen simples",
      "exams": [
        {
          "code": "RXAB1",
          "modality": "radiologia_convencional",
          "name": "ABDOMEN SIMPLES",
          "preparationId": "radiologia_sem_preparo"
        },
        {
          "code": "RXAB4",
          "modality": "radiologia_convencional",
          "name": "ABDOMEN SIMPLES",
          "preparationId": "radiologia_sem_preparo"
        }
      ]
    },
    {
      "normalizedName": "coluna cervical ap p to obl",
      "exams": [
        {
          "code": "RXCL2",
          "modality": "radiologia_convencional",
          "name": "COLUNA CERVICAL (AP+P+TO+OBL)",
          "preparationId": "radiologia_sem_preparo"
        },
        {
          "code": "RXCL4",
          "modality": "radiologia_convencional",
          "name": "COLUNA CERVICAL (AP+P+TO+OBL)",
          "preparationId": "radiologia_sem_preparo"
        }
      ]
    },
    {
      "normalizedName": "tc coracao para avaliacao do escore de calcio coronariano",
      "exams": [
        {
          "code": "TCOR",
          "modality": "medicina_nuclear",
          "name": "TC CORAÇÃO - PARA AVALIAÇÃO DO ESCORE DE CÁLCIO CORONARIANO",
          "preparationId": "medicina_nuclear_generico"
        },
        {
          "code": "TCOR",
          "modality": "tomografia_computadorizada",
          "name": "TC CORAÇÃO - PARA AVALIAÇÃO DO ESCORE DE CÁLCIO CORONARIANO",
          "preparationId": "tc_simples"
        }
      ]
    },
    {
      "normalizedName": "tomografia de abdomen superior com contraste com sedacao",
      "exams": [
        {
          "code": "TCAS1",
          "modality": "tomografia_computadorizada",
          "name": "TOMOGRAFIA DE ABDOMEN SUPERIOR COM CONTRASTE COM SEDACAO",
          "preparationId": "tc_simples"
        },
        {
          "code": "TCAS2",
          "modality": "tomografia_computadorizada",
          "name": "TOMOGRAFIA DE ABDOMEN SUPERIOR COM CONTRASTE COM SEDACAO",
          "preparationId": "tc_contraste"
        }
      ]
    },
    {
      "normalizedName": "tomografia de coracao para avaliacao do escore de calcio coronariano com contraste",
      "exams": [
        {
          "code": "TCCCC",
          "modality": "tomografia_computadorizada",
          "name": "TOMOGRAFIA DE CORAÇAO PARA AVALIAÇAO DO ESCORE DE CALCIO CORONARIANO COM CONTRASTE",
          "preparationId": "tc_contraste"
        },
        {
          "code": "TCORC",
          "modality": "tomografia_computadorizada",
          "name": "TOMOGRAFIA DE CORAÇÃO - PARA AVALIAÇÃO DO ESCORE DE CÁLCIO CORONARIANO COM CONTRASTE",
          "preparationId": "tc_contraste"
        }
      ]
    },
    {
      "normalizedName": "tomografia de esterno com contraste",
      "exams": [
        {
          "code": "TEC",
          "modality": "tomografia_computadorizada",
          "name": "TOMOGRAFIA DE ESTERNO COM CONTRASTE",
          "preparationId": "tc_contraste"
        },
        {
          "code": "TESCC",
          "modality": "tomografia_computadorizada",
          "name": "TOMOGRAFIA DE ESTERNO COM CONTRASTE",
          "preparationId": "tc_contraste"
        }
      ]
    },
    {
      "normalizedName": "tunel ou fossa intercondiliana direita",
      "exams": [
        {
          "code": "RXTID",
          "modality": "radiologia_convencional",
          "name": "TÚNEL OU FOSSA INTERCONDILIANA DIREITA",
          "preparationId": "radiologia_sem_preparo"
        },
        {
          "code": "RXTU3",
          "modality": "radiologia_convencional",
          "name": "TUNEL OU FOSSA INTERCONDILIANA DIREITA",
          "preparationId": "radiologia_sem_preparo"
        }
      ]
    }
  ],
  "orphanPreparations": [
    "rx_enema_opaco_adulto",
    "rx_enema_opaco_crianca"
  ],
  "pendingAssociations": [
    {
      "code": "MAMPC",
      "modality": "mamografia",
      "name": "MAMOGRAFIA PARA AVALIAÇÃO DE MICROCALCIFICAÇÃO EM PEÇA CIRÚRGICA",
      "preparationId": "mamografia_pendente",
      "status": "needs-review",
      "reason": "Procedimento em peça cirúrgica; não aplicar preparo de paciente sem fonte específica."
    },
    {
      "code": "BPGUS",
      "modality": "ultrassonografia",
      "name": "BIÓPSIA DE PRÓSTATA GUIADA POR ULTRASSONOGRAFIA",
      "preparationId": "us_pendente",
      "status": "needs-review",
      "reason": "Sem equivalência documental demonstrada com o grupo abdominal/pélvico; não inferir preparo."
    },
    {
      "code": "USAAI",
      "modality": "ultrassonografia",
      "name": "ECO 3 OU MAIS VASOS COM DOPPLER A CORES - DA AORTO ABDOMINAL, DAS VEIAS ILÍACAS E FEMURAIS",
      "preparationId": "us_pendente",
      "status": "needs-review",
      "reason": "Sem equivalência documental demonstrada com o grupo abdominal/pélvico; não inferir preparo."
    },
    {
      "code": "USABD",
      "modality": "ultrassonografia",
      "name": "ABDOMINAL SUPERIOR",
      "preparationId": "us_abdômen",
      "status": "documentary-review",
      "reason": "Associação restrita ao exame explicitamente descrito em S05; homologação UDI pendente."
    },
    {
      "code": "USABT",
      "modality": "ultrassonografia",
      "name": "ABDÔMEN TOTAL",
      "preparationId": "us_abdômen",
      "status": "documentary-review",
      "reason": "Associação restrita ao exame explicitamente descrito em S05; homologação UDI pendente."
    },
    {
      "code": "USAPU",
      "modality": "ultrassonografia",
      "name": "APARELHO URINÁRIO",
      "preparationId": "us_pelvica_vias_urinarias",
      "status": "documentary-review",
      "reason": "Associação restrita ao exame explicitamente descrito em S05; homologação UDI pendente."
    },
    {
      "code": "USAR",
      "modality": "ultrassonografia",
      "name": "ECO ABD - RENAL C/DOPPLER A CORES",
      "preparationId": "us_doppler_arterias_renais",
      "status": "documentary-review",
      "reason": "Associação restrita ao exame explicitamente descrito em S05; homologação UDI pendente."
    },
    {
      "code": "USBI1",
      "modality": "ultrassonografia",
      "name": "BIÓPSIA ORIENTADA POR ECOGRAFIA RENAL",
      "preparationId": "us_pendente",
      "status": "needs-review",
      "reason": "Sem equivalência documental demonstrada com o grupo abdominal/pélvico; não inferir preparo."
    },
    {
      "code": "USBI6",
      "modality": "ultrassonografia",
      "name": "PUNÇÃO ABDOMINAL ORIENTADA POR ECOGRAFIA",
      "preparationId": "us_pendente",
      "status": "needs-review",
      "reason": "Sem equivalência documental demonstrada com o grupo abdominal/pélvico; não inferir preparo."
    },
    {
      "code": "USCAA",
      "modality": "ultrassonografia",
      "name": "ABDÔMEN COM DOPPLER A CORES",
      "preparationId": "us_pendente",
      "status": "needs-review",
      "reason": "Sem equivalência documental demonstrada com o grupo abdominal/pélvico; não inferir preparo."
    },
    {
      "code": "USGIN",
      "modality": "ultrassonografia",
      "name": "PÉLVICA ABDOMINAL",
      "preparationId": "us_pelvica_vias_urinarias",
      "status": "documentary-review",
      "reason": "Associação restrita ao exame explicitamente descrito em S05; homologação UDI pendente."
    },
    {
      "code": "USGP",
      "modality": "ultrassonografia",
      "name": "ULTRASSONOGRAFIA DE ABDOMEN TOTAL PRÉ-TRANSPLANTE",
      "preparationId": "us_pendente",
      "status": "needs-review",
      "reason": "Sem equivalência documental demonstrada com o grupo abdominal/pélvico; não inferir preparo."
    },
    {
      "code": "USGPA",
      "modality": "ultrassonografia",
      "name": "ECO PAREDE ABDOMINAL",
      "preparationId": "us_pendente",
      "status": "needs-review",
      "reason": "Sem equivalência documental demonstrada com o grupo abdominal/pélvico; não inferir preparo."
    },
    {
      "code": "USHOM",
      "modality": "ultrassonografia",
      "name": "ECO PÉLVICA ABDOMINAL (HOMENS)",
      "preparationId": "us_pelvica_vias_urinarias",
      "status": "documentary-review",
      "reason": "Associação restrita ao exame explicitamente descrito em S05; homologação UDI pendente."
    },
    {
      "code": "USPRO",
      "modality": "ultrassonografia",
      "name": "PRÓSTATA VIA ABDOMINAL",
      "preparationId": "us_pendente",
      "status": "needs-review",
      "reason": "Sem equivalência documental demonstrada com o grupo abdominal/pélvico; não inferir preparo."
    },
    {
      "code": "USPTV",
      "modality": "ultrassonografia",
      "name": "PÉLVICA TRANSVAGINAL",
      "preparationId": "us_pendente",
      "status": "needs-review",
      "reason": "Sem equivalência documental demonstrada com o grupo abdominal/pélvico; não inferir preparo."
    },
    {
      "code": "USSRV",
      "modality": "ultrassonografia",
      "name": "USS REGULAÇÃO VIAS URINÁRIAS",
      "preparationId": "us_pendente",
      "status": "needs-review",
      "reason": "Sem equivalência documental demonstrada com o grupo abdominal/pélvico; não inferir preparo."
    },
    {
      "code": "USTDC",
      "modality": "ultrassonografia",
      "name": "ECO TRANSVAGINAL C/ DOPPLER A CORES",
      "preparationId": "us_pendente",
      "status": "needs-review",
      "reason": "Sem equivalência documental demonstrada com o grupo abdominal/pélvico; não inferir preparo."
    }
  ],
  "sourceConflictingNames": []
}
```

## Limitações

- A auditoria detecta inconsistências estruturais; não valida correção clínica.
- Códigos e nomes compartilhados podem ser legítimos e exigem revisão da UDI.
- Status ok significa cadastro preenchido, não homologação clínica.

## Reprodução

```bash
pnpm audit:catalog
pnpm audit:catalog:check
```
