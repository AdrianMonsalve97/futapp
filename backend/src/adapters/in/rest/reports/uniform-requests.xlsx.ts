import ExcelJS from 'exceljs';
import type {UniformRequest} from '../../../../domain/entities';
import type {UniformRequestFilters} from '../../../../domain/uniform-request-filter';

const kinds:Record<string,string>={completo:'Uniforme completo con medias',camiseta:'Solo camiseta',pantalon:'Pantaloneta',medias:'Medias',buzo:'Buzo',entrenamiento:'Entrenamiento',guantes:'Guantes'};
const variants:Record<string,string>={titular:'Local',alterna:'Visitante',entrenamiento:'Entrenamiento'};
const position:Record<string,string>={POR:'Portero',DEF:'Defensa',MED:'Mediocampista',DEL:'Delantero'};
const recipient:Record<string,string>={jugador:'Jugador',pareja:'Pareja',hijo:'Hijo/a'};
const date=(value:string|null)=>{
  if(!value)return null;
  const parsed=new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(value)?value:value.replace(' ','T')+'Z');
  return Number.isFinite(parsed.getTime())?parsed:value;
};
/** Real XLSX, with literal text cells (never formulas from player-entered names/details). */
export async function uniformRequestsWorkbook(requests:UniformRequest[],filters:UniformRequestFilters,createdAt=new Date()):Promise<Buffer> {
  const workbook=new ExcelJS.Workbook();workbook.creator='FutApp';workbook.created=createdAt;
  const sheet=workbook.addWorksheet('Solicitudes',{views:[{state:'frozen',xSplit:4,ySplit:4}],pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9}});
  const headers=['Solicitud','Fecha UTC','Jugador','Dorsal','Posición','Correo del jugador','Para quién','Nombre destinatario','Prenda','Tipo','Variante','Talla','Valor COP','Estado','Observaciones / detalles','Notas de revisión','Revisada UTC','Entrega'];
  const widths=[10,21,30,9,19,32,14,30,32,30,17,10,18,17,54,38,21,10];
  sheet.columns=widths.map(width=>({width}));
  sheet.mergeCells('A1:R1');sheet.getCell('A1').value='FutApp · Solicitudes de uniformes y equipamiento';sheet.getRow(1).height=32;
  sheet.getCell('A1').font={name:'Calibri',size:18,bold:true,color:{argb:'FFF0D799'}};sheet.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF15231E'}};
  sheet.mergeCells('A2:R2');sheet.getCell('A2').value=`Exportado ${createdAt.toISOString()} · ${requests.length} registros · Estado: ${filters.status??'todos'} · Variante: ${variants[filters.variant??'']??'todas'} · Búsqueda: ${filters.search??'sin filtro'}`;
  sheet.getCell('A2').font={name:'Calibri',size:10,color:{argb:'FF475569'}};sheet.getRow(2).height=24;
  sheet.addTable({name:'Solicitudes',ref:'A4',headerRow:true,totalsRow:false,style:{theme:'TableStyleMedium13',showRowStripes:true},columns:headers.map(name=>({name,filterButton:true})),rows:requests.map(row=>[
    row.id,date(row.createdAt),row.playerName??'',row.playerShirtNumber??null,position[row.playerPosition??'']??'',row.playerEmail??'',recipient[row.recipientType??'jugador'],row.recipientType&&row.recipientType!=='jugador'?row.recipientName??'':row.playerName??'',row.uniformName??'',kinds[row.uniformKind??'']??'',variants[row.uniformVariant??'']??'',row.size,row.quotedPrice??null,row.status,row.reason??'',row.reviewNotes??'',date(row.reviewedAt),row.issueId??null,
  ])});
  sheet.getRow(4).height=26;
  for(let index=5;index<=requests.length+4;index++){
    const row=sheet.getRow(index);row.height=42;row.alignment={vertical:'top',wrapText:true};row.font={name:'Calibri',size:11};
    row.getCell(2).numFmt='yyyy-mm-dd hh:mm';row.getCell(17).numFmt='yyyy-mm-dd hh:mm';row.getCell(13).numFmt='"$" #,##0.00';
    for(const column of [1,4,12,18])row.getCell(column).alignment={vertical:'top',horizontal:'center'};
  }
  sheet.pageSetup.printTitlesRow='1:4';
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
