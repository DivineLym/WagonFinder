import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const PDFDocument = require('pdfkit');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'test-pdfs');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

// Extract Roboto fonts from pdfmake's vfs for Cyrillic support
const FONT_DIR = path.join(__dirname, '..', '.tmp-fonts');
if (!fs.existsSync(FONT_DIR)) fs.mkdirSync(FONT_DIR);

const vfs = require('pdfmake/build/vfs_fonts');
const FONT_REGULAR = path.join(FONT_DIR, 'Roboto-Regular.ttf');
const FONT_BOLD    = path.join(FONT_DIR, 'Roboto-Medium.ttf');
if (!fs.existsSync(FONT_REGULAR)) fs.writeFileSync(FONT_REGULAR, Buffer.from(vfs['Roboto-Regular.ttf'], 'base64'));
if (!fs.existsSync(FONT_BOLD))    fs.writeFileSync(FONT_BOLD,    Buffer.from(vfs['Roboto-Medium.ttf'],  'base64'));

// ── Test data ──────────────────────────────────────────────────────────────────
const SHIPPERS = [
  { name: 'ТОО «КазАгроЭкспорт»',             bin: '180340012345', address: 'г. Астана, ул. Сейфуллина 12' },
  { name: 'АО «КазМунайГаз Транспортировка»',  bin: '030940002718', address: 'г. Атырау, пр. Азаттык 5' },
  { name: 'ТОО «Степной Зерновой Альянс»',     bin: '150640023411', address: 'г. Костанай, ул. Байтурсынова 89' },
  { name: 'АО «ENRC Kazakhstan»',              bin: '040540007612', address: 'г. Павлодар, ул. Ленина 45' },
  { name: 'ТОО «Актауский Нефтяной Терминал»', bin: '120240034567', address: 'г. Актау, мкр. 12, д. 56' },
  { name: 'ТОО «КазФосфат»',                  bin: '061240045678', address: 'г. Тараз, ул. Толе би 32' },
  { name: 'АО «Шубарколь Комир»',             bin: '920140056789', address: 'г. Карагандa, пр. Нурсултана 10' },
];

const CARGOS = [
  { name: 'Зерно пшеница',        etsng: '011063', gng: '100190', wagon: 'Хоппер',       wCode: '405' },
  { name: 'Нефть сырая',          etsng: '211001', gng: '270900', wagon: 'Цистерна',      wCode: '601' },
  { name: 'Уголь каменный',       etsng: '161002', gng: '270112', wagon: 'Полувагон',     wCode: '001' },
  { name: 'Ячмень',               etsng: '011066', gng: '100300', wagon: 'Хоппер',        wCode: '405' },
  { name: 'Дизельное топливо',    etsng: '212065', gng: '271019', wagon: 'Цистерна',      wCode: '601' },
  { name: 'Руда железная',        etsng: '091001', gng: '260111', wagon: 'Полувагон',     wCode: '001' },
  { name: 'Подсолнечник',         etsng: '011079', gng: '120600', wagon: 'Хоппер',        wCode: '405' },
  { name: 'Мазут топочный',       etsng: '212061', gng: '271020', wagon: 'Цистерна',      wCode: '601' },
  { name: 'Удобрения азотные',    etsng: '226021', gng: '310210', wagon: 'Крытый вагон',  wCode: '201' },
  { name: 'Кукуруза',             etsng: '011068', gng: '100590', wagon: 'Хоппер',        wCode: '405' },
  { name: 'Бензин автомобильный', etsng: '212041', gng: '271012', wagon: 'Цистерна',      wCode: '601' },
  { name: 'Медная руда',          etsng: '093001', gng: '260300', wagon: 'Полувагон',     wCode: '001' },
  { name: 'Глинозём',             etsng: '111001', gng: '281820', wagon: 'Хоппер',        wCode: '405' },
  { name: 'Хлопок',               etsng: '511001', gng: '520100', wagon: 'Крытый вагон',  wCode: '201' },
  { name: 'Лесоматериалы',        etsng: '131001', gng: '440729', wagon: 'Платформа',     wCode: '301' },
];

const ROUTES = [
  { depName: 'Петропавловск',     depEsr: '802200', arrName: 'Костанай',      arrEsr: '804504' },
  { depName: 'Алматы-1',         depEsr: '654205', arrName: 'Астана',        arrEsr: '802602' },
  { depName: 'Атырау',           depEsr: '706101', arrName: 'Актау',         arrEsr: '726301' },
  { depName: 'Павлодар',         depEsr: '852102', arrName: 'Семей',         arrEsr: '862101' },
  { depName: 'Шымкент',          depEsr: '668101', arrName: 'Тараз',         arrEsr: '662109' },
  { depName: 'Кокшетау',         depEsr: '800101', arrName: 'Петропавловск', arrEsr: '802200' },
  { depName: 'Актобе',           depEsr: '728201', arrName: 'Уральск',       arrEsr: '720101' },
  { depName: 'Усть-Каменогорск', depEsr: '864101', arrName: 'Алматы-1',     arrEsr: '654205' },
  { depName: 'Карагандa',        depEsr: '836401', arrName: 'Балхаш',       arrEsr: '846100' },
  { depName: 'Астана',           depEsr: '802602', arrName: 'Алматы-1',     arrEsr: '654205' },
  { depName: 'Костанай',         depEsr: '804504', arrName: 'Алматы-1',     arrEsr: '654205' },
  { depName: 'Атырау',           depEsr: '706101', arrName: 'Астана',       arrEsr: '802602' },
];

function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rndInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function fmt(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}.${m}.${date.getFullYear()}`;
}

const MONTHS_RU = ['январь','февраль','март','апрель','май','июнь',
                   'июль','август','сентябрь','октябрь','ноябрь','декабрь'];

// ── Draw helpers ──────────────────────────────────────────────────────────────
function hline(doc, y) {
  doc.moveTo(40, y).lineTo(555, y).strokeColor('#cccccc').lineWidth(0.5).stroke();
}

function labelValue(doc, y, label, value, lx = 40, vx = 200) {
  doc.font(FONT_BOLD).fontSize(8).fillColor('#444').text(label, lx, y, { lineBreak: false });
  doc.font(FONT_REGULAR).fontSize(9).fillColor('#111').text(value || '—', vx, y, { lineBreak: false });
  return y + 18;
}

function sectionHeader(doc, y, text) {
  doc.rect(40, y, 515, 16).fill('#f0f4f8');
  doc.font(FONT_BOLD).fontSize(9).fillColor('#1a365d').text(text, 46, y + 3, { lineBreak: false });
  return y + 20;
}

function tableHeader(doc, y, cols) {
  doc.rect(40, y, 515, 18).fill('#e2e8f0');
  let x = 40;
  for (const col of cols) {
    doc.font(FONT_BOLD).fontSize(7).fillColor('#2d3748')
      .text(col.label, x + 2, y + 4, { width: col.w - 4, align: col.align ?? 'left', lineBreak: false });
    x += col.w;
  }
  return y + 18;
}

function tableRow(doc, y, cols, values, shaded = false) {
  if (shaded) doc.rect(40, y, 515, 16).fill('#f7fafc');
  let x = 40;
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    doc.font(FONT_REGULAR).fontSize(8).fillColor('#1a202c')
      .text(String(values[i] ?? '—'), x + 2, y + 3, { width: col.w - 4, align: col.align ?? 'left', lineBreak: false });
    x += col.w;
  }
  // row bottom border
  doc.moveTo(40, y + 16).lineTo(555, y + 16).strokeColor('#e2e8f0').lineWidth(0.3).stroke();
  return y + 16;
}

// ── Generate one PDF ──────────────────────────────────────────────────────────
function generatePdf(index, outPath) {
  const shipper = rnd(SHIPPERS);
  const cargo   = rnd(CARGOS);
  const route   = rnd(ROUTES);
  const qty     = rndInt(5, 60);
  const tons    = qty * rndInt(55, 73);

  const regDate    = new Date(2026, rndInt(0, 11), rndInt(1, 28));
  const planMonth  = new Date(regDate); planMonth.setMonth(planMonth.getMonth() + rndInt(1, 3));
  const periodStart = new Date(planMonth.getFullYear(), planMonth.getMonth(), 1);
  const periodEnd   = new Date(planMonth.getFullYear(), planMonth.getMonth() + 1, 0);

  const guNumber  = `ГУ12-BULK-${String(index).padStart(3, '0')}-${rndInt(1000, 9999)}`;
  const planNum   = String(rndInt(1000, 9999));

  const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `Заявка ГУ-12 ${guNumber}` } });
  doc.registerFont('Regular', FONT_REGULAR);
  doc.registerFont('Bold',    FONT_BOLD);

  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  let y = 30;

  // ── Top badge ──────────────────────────────────────────────────────────────
  doc.rect(40, y, 515, 30).fill('#1a365d');
  doc.font(FONT_BOLD).fontSize(14).fillColor('#ffffff')
    .text('ЗАЯВКА (ПЛАН) НА ПЕРЕВОЗКУ  —  Форма ГУ-12', 50, y + 8, { lineBreak: false });
  y += 36;

  // ── Number & date row ──────────────────────────────────────────────────────
  doc.rect(40, y, 515, 22).fill('#ebf4ff');
  doc.font(FONT_BOLD).fontSize(10).fillColor('#2b6cb0')
    .text(`№ заявки: ${guNumber}`, 46, y + 6, { lineBreak: false });
  doc.font(FONT_REGULAR).fontSize(9).fillColor('#4a5568')
    .text(`Дата регистрации: ${fmt(regDate)}`, 350, y + 7, { lineBreak: false });
  y += 26;

  // ── Carrier section ────────────────────────────────────────────────────────
  y = sectionHeader(doc, y, 'ПЕРЕВОЗЧИК');
  y = labelValue(doc, y, 'Наименование:', 'АО «Қазақстан Темір Жолы» (КТЖ)');
  y = labelValue(doc, y, 'Адрес:', 'г. Астана, пр. Мәңгілік Ел 8');
  y += 6;

  // ── Shipper section ────────────────────────────────────────────────────────
  y = sectionHeader(doc, y, 'ГРУЗООТПРАВИТЕЛЬ');
  y = labelValue(doc, y, 'Наименование:', shipper.name);
  y = labelValue(doc, y, 'БИН:', shipper.bin);
  y = labelValue(doc, y, 'Адрес:', shipper.address);
  y += 6;

  // ── Route section ──────────────────────────────────────────────────────────
  y = sectionHeader(doc, y, 'МАРШРУТ ПЕРЕВОЗКИ');
  y = labelValue(doc, y, 'Станция отправления:', `${route.depName}  (ЕСР: ${route.depEsr})`);
  y = labelValue(doc, y, 'Станция назначения:', `${route.arrName}  (ЕСР: ${route.arrEsr})`);
  y = labelValue(doc, y, 'Страна назначения:', 'KZ  Казахстан');
  y += 6;

  // ── Cargo section ──────────────────────────────────────────────────────────
  y = sectionHeader(doc, y, 'СВЕДЕНИЯ О ГРУЗЕ');
  y = labelValue(doc, y, 'Наименование груза:', cargo.name);
  y = labelValue(doc, y, 'Код ЕТСНГ:', cargo.etsng);
  y = labelValue(doc, y, 'Код ГНГ:', cargo.gng);
  y = labelValue(doc, y, 'Вид вагона:', `${cargo.wagon}  (код ${cargo.wCode})`);
  y += 6;

  // ── Quantity section ───────────────────────────────────────────────────────
  y = sectionHeader(doc, y, 'ОБЪЁМ И ПЕРИОД ПЕРЕВОЗКИ');
  y = labelValue(doc, y, 'Месяц перевозки:', `${MONTHS_RU[planMonth.getMonth()]} ${planMonth.getFullYear()} г.`);
  y = labelValue(doc, y, 'Период:', `${fmt(periodStart)} — ${fmt(periodEnd)}`);
  y = labelValue(doc, y, 'Количество вагонов:', `${qty} вагонов`);
  y = labelValue(doc, y, 'Общий вес груза:', `${tons} тонн`);
  y += 10;

  // ── Main data table ────────────────────────────────────────────────────────
  y = sectionHeader(doc, y, 'ОСНОВНАЯ ТАБЛИЦА ЗАЯВКИ');
  const mainCols = [
    { label: 'Признак перевозки', w: 80 },
    { label: '№ плана',           w: 55 },
    { label: 'Код ст. отпр.',     w: 70 },
    { label: 'Код ЕТСНГ',         w: 65 },
    { label: 'Код вагона',        w: 65 },
    { label: 'Кол-во вагонов',    w: 90, align: 'center' },
    { label: 'Всего',             w: 90, align: 'center' },
  ];
  y = tableHeader(doc, y, mainCols);
  y = tableRow(doc, y, mainCols, ['0', planNum, route.depEsr, cargo.etsng, cargo.wCode, qty, qty], false);
  y += 8;

  // ── Detail table ───────────────────────────────────────────────────────────
  y = sectionHeader(doc, y, 'ДЕТАЛИЗАЦИЯ ПО ГРУЗУ');
  const detCols = [
    { label: 'Точное наименование груза', w: 120 },
    { label: 'Код ЕТСНГ',                w: 55 },
    { label: 'Код ГНГ',                  w: 55 },
    { label: 'Назначение',               w: 90 },
    { label: 'ЕСР назн.',                w: 60 },
    { label: 'Тонн в месяц',             w: 65, align: 'right' },
    { label: 'Вагонов',                  w: 70, align: 'right' },
  ];
  y = tableHeader(doc, y, detCols);
  y = tableRow(doc, y, detCols, [cargo.name, cargo.etsng, cargo.gng, route.arrName, route.arrEsr, tons, qty], false);
  // total row
  y = tableRow(doc, y, detCols, ['ИТОГО', '', '', '', '', tons, qty], true);
  y += 16;

  // ── Signature block ────────────────────────────────────────────────────────
  hline(doc, y); y += 10;
  doc.font(FONT_REGULAR).fontSize(8).fillColor('#555')
    .text('За достоверность сведений, внесённых в заявку, несу ответственность.', 40, y);
  y += 14;

  const sigY = y;
  doc.font(FONT_BOLD).fontSize(8).fillColor('#444')
    .text('Грузоотправитель:', 40, sigY + 2, { lineBreak: false });
  doc.moveTo(160, sigY + 14).lineTo(310, sigY + 14).strokeColor('#999').lineWidth(0.5).stroke();
  doc.font(FONT_REGULAR).fontSize(7).fillColor('#888').text('(должность)', 160, sigY + 16, { lineBreak: false });
  doc.moveTo(320, sigY + 14).lineTo(440, sigY + 14).strokeColor('#999').lineWidth(0.5).stroke();
  doc.font(FONT_REGULAR).fontSize(7).fillColor('#888').text('(подпись)', 320, sigY + 16, { lineBreak: false });
  doc.moveTo(450, sigY + 14).lineTo(555, sigY + 14).strokeColor('#999').lineWidth(0.5).stroke();
  doc.font(FONT_REGULAR).fontSize(7).fillColor('#888').text('(Ф.И.О.)', 450, sigY + 16, { lineBreak: false });
  y = sigY + 32;

  doc.font(FONT_BOLD).fontSize(8).fillColor('#444')
    .text(`Дата: ${fmt(new Date())}`, 40, y, { lineBreak: false });
  y += 20;

  // ── Footer ─────────────────────────────────────────────────────────────────
  doc.rect(40, y, 515, 20).fill('#f0f4f8');
  doc.font(FONT_REGULAR).fontSize(7).fillColor('#718096')
    .text(`Форма ГУ-12  ·  КТЖ  ·  ${guNumber}  ·  Период: ${fmt(periodStart)}–${fmt(periodEnd)}`, 46, y + 6, { lineBreak: false });

  doc.end();
  return new Promise((res, rej) => {
    stream.on('finish', res);
    stream.on('error', rej);
  });
}

// ── Run ───────────────────────────────────────────────────────────────────────
console.log('Генерируем 25 тестовых ГУ-12...\n');

for (let i = 1; i <= 25; i++) {
  const safeName = `GU12_${String(i).padStart(3, '0')}`;
  const outPath  = path.join(OUT_DIR, `${safeName}.pdf`);
  await generatePdf(i, outPath);
  console.log(`✓ ${path.basename(outPath)}`);
}

console.log(`\nГотово! 25 PDF сохранены в: ${OUT_DIR}`);
