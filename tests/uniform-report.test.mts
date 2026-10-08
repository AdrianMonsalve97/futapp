import {test} from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {uniformRequestsWorkbook} from '../backend/src/adapters/in/rest/reports/uniform-requests.xlsx';
import {filterUniformRequests as backendFilter} from '../backend/src/domain/uniform-request-filter';
import {filterUniformRequests as frontendFilter,uniformRequestExportUrl,filterUniformCatalog} from '../frontend/src/utils/uniforms';
import type {UniformRequest,Uniform} from '../backend/src/domain/entities';

const fixture:UniformRequest={id:77,playerId:9,playerName:'Andrés Prueba',playerShirtNumber:0,playerPosition:'POR',playerEmail:'fixture@test.local',uniformId:2,uniformName:'Camiseta visitante',uniformKind:'camiseta',uniformVariant:'alterna',size:'08',reason:'=HYPERLINK("https://example.invalid","NO")\nNombre María',recipientType:'hijo',recipientName:'+SUM(1,2)',quotedPrice:0,status:'pendiente',reviewNotes:'@literal',createdAt:'2026-10-08 13:22:00',reviewedAt:null,issueId:null};

test('XLSX is a styled native table, preserving zero values, sizes and literal player text',async()=>{
  const book=new ExcelJS.Workbook();await book.xlsx.load(await uniformRequestsWorkbook([fixture],{},new Date('2026-10-08T00:00:00Z')));
  const sheet=book.getWorksheet('Solicitudes')!;
  assert.equal(sheet.getCell('D5').value,0);assert.equal(sheet.getCell('E5').value,'Portero');assert.equal(sheet.getCell('L5').value,'08');assert.equal(sheet.getCell('M5').value,0);assert.equal(sheet.getCell('H5').value,fixture.recipientName);assert.equal(sheet.getCell('O5').value,fixture.reason);assert.equal(sheet.getCell('P5').value,'@literal');
  for(const column of ['H','O','P'])assert.equal(sheet.getCell(column+'5').type,ExcelJS.ValueType.String);
  assert.equal((sheet.getCell('B5').value as Date).toISOString(),'2026-10-08T13:22:00.000Z');assert.equal(sheet.views[0].state,'frozen');assert.equal(sheet.views[0].ySplit,4);assert.equal(sheet.getTable('Solicitudes').name,'Solicitudes');assert.equal(sheet.columnCount,18);
  assert.equal(sheet.getCell('R5').value,null);assert.match(sheet.getCell('M5').numFmt,/#,##0/);
});
test('UI and server filters agree on accents, family detail, state, variant and dorsal zero',()=>{
  const other={...fixture,id:88,playerName:'Otro jugador',playerShirtNumber:5,recipientName:'Familiar',reason:'Distinto',uniformVariant:'titular' as const,status:'entregada' as const};
  for(const filters of [{search:'ANDRES',status:'',variant:''},{search:'maría',status:'pendiente',variant:'alterna'},{search:'0',status:'',variant:''},{search:'',status:'entregada',variant:'titular'},{search:'no coincide',status:'',variant:''}] as const){
    const expected=backendFilter([fixture,other],{search:filters.search,status:filters.status||undefined,variant:filters.variant||undefined});assert.deepEqual(frontendFilter([fixture,other],filters),expected);
  }
  const url=new URL(uniformRequestExportUrl({search:'+nombre & observación',status:'pendiente',variant:'alterna'}),'https://test.invalid');assert.equal(url.searchParams.get('search'),'+nombre & observación');assert.equal(url.searchParams.get('status'),'pendiente');
});
test('export includes every matching order beyond a UI page and excludes unmatched records',async()=>{
  const rows=Array.from({length:26},(_,index)=>({...fixture,id:index+1,status:index===25?'entregada' as const:'pendiente' as const}));
  const matching=backendFilter(rows,{status:'pendiente'}),book=new ExcelJS.Workbook();await book.xlsx.load(await uniformRequestsWorkbook(matching,{status:'pendiente'}));
  const sheet=book.getWorksheet('Solicitudes')!;assert.equal(matching.length,25);assert.equal(sheet.getCell('A29').value,25);assert.equal(sheet.getCell('A30').value,null);
});
test('catalog filters distinguish full kits, family shirts and equipment without changing source order',()=>{
  const base={id:1,name:'Local',kind:'completo',variant:'titular',price:120000,stock:0,minStock:1,active:true,createdAt:'2026-10-08'} as Uniform;
  const products=[base,{...base,id:2,name:'Visitante',kind:'camiseta' as const,variant:'alterna' as const,price:40000},{...base,id:3,name:'Guantes',kind:'guantes' as const,price:30000}];
  assert.deepEqual(filterUniformCatalog(products,'','equipamiento','','featured').map(row=>row.id),[3]);assert.deepEqual(filterUniformCatalog(products,'alterna','camiseta','','featured').map(row=>row.id),[2]);assert.deepEqual(filterUniformCatalog(products,'','all','','priceAsc').map(row=>row.id),[3,2,1]);assert.deepEqual(products.map(row=>row.id),[1,2,3]);assert.equal(filterUniformCatalog(products,'','completo','','featured')[0].stock,0);
});
