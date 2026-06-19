import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const PDFDocument = require('pdfkit');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'test-pdfs', 'bad');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const FONT_DIR = path.join(__dirname, '..', '.tmp-fonts');
const vfs = require('pdfmake/build/vfs_fonts');
const FONT_REGULAR = path.join(FONT_DIR, 'Roboto-Regular.ttf');
const FONT_BOLD    = path.join(FONT_DIR, 'Roboto-Medium.ttf');
if (!fs.existsSync(FONT_REGULAR)) fs.writeFileSync(FONT_REGULAR, Buffer.from(vfs['Roboto-Regular.ttf'], 'base64'));
if (!fs.existsSync(FONT_BOLD))    fs.writeFileSync(FONT_BOLD,    Buffer.from(vfs['Roboto-Medium.ttf'],  'base64'));

function makePdf(outPath, drawFn) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.registerFont('Regular', FONT_REGULAR);
  doc.registerFont('Bold', FONT_BOLD);
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);
  drawFn(doc);
  doc.end();
  return new Promise((res, rej) => { stream.on('finish', res); stream.on('error', rej); });
}

const CASES = [
  // 1. Несуществующий код ЕТСНГ
  {
    name: 'BAD_001_wrong_etsng.pdf',
    desc: 'Неверный код ЕТСНГ (999999)',
    draw(doc) {
      doc.font('Bold').fontSize(14).text('ЗАЯВКА (ПЛАН) НА ПЕРЕВОЗКУ — Форма ГУ-12');
      doc.font('Regular').fontSize(10).moveDown();
      doc.text('№ заявки: ГУ12-BAD-001-0001');
      doc.text('Дата регистрации: 15.06.2026');
      doc.moveDown();
      doc.text('Грузоотправитель: ТОО «ТестКарго»');
      doc.text('БИН: 123456789012');
      doc.moveDown();
      doc.text('Станция отправления: Астана  ЕСР: 802602');
      doc.text('Станция назначения: Алматы-1  ЕСР: 654205');
      doc.moveDown();
      doc.text('Наименование груза: Антиматерия');
      doc.text('Код ЕТСНГ: 999999');   // несуществующий
      doc.text('Код ГНГ: 000000');
      doc.text('Вид вагона: Цистерна');
      doc.moveDown();
      doc.text('Количество вагонов: 10');
      doc.text('Общий вес груза: 650 тонн');
      doc.text('Период: 01.08.2026 — 31.08.2026');
    },
  },

  // 2. Неверный код ЕСР (несуществующая станция)
  {
    name: 'BAD_002_wrong_esr.pdf',
    desc: 'Неверный код ЕСР (000001)',
    draw(doc) {
      doc.font('Bold').fontSize(14).text('ЗАЯВКА (ПЛАН) НА ПЕРЕВОЗКУ — Форма ГУ-12');
      doc.font('Regular').fontSize(10).moveDown();
      doc.text('№ заявки: ГУ12-BAD-002-0002');
      doc.text('Дата регистрации: 10.05.2026');
      doc.moveDown();
      doc.text('Грузоотправитель: ТОО «ЛогистикПлюс»');
      doc.text('БИН: 987654321098');
      doc.moveDown();
      doc.text('Станция отправления: Несуществующая  ЕСР: 000001');  // неверный ЕСР
      doc.text('Станция назначения: Тоже несуществующая  ЕСР: 000002');
      doc.moveDown();
      doc.text('Наименование груза: Уголь каменный');
      doc.text('Код ЕТСНГ: 161002');
      doc.text('Вид вагона: Полувагон');
      doc.moveDown();
      doc.text('Количество вагонов: 25');
      doc.text('Период: 01.07.2026 — 31.07.2026');
    },
  },

  // 3. Название станции не совпадает с кодом ЕСР
  {
    name: 'BAD_003_esr_name_mismatch.pdf',
    desc: 'Код ЕСР от Атырау, а название станции — Алматы',
    draw(doc) {
      doc.font('Bold').fontSize(14).text('ЗАЯВКА (ПЛАН) НА ПЕРЕВОЗКУ — Форма ГУ-12');
      doc.font('Regular').fontSize(10).moveDown();
      doc.text('№ заявки: ГУ12-BAD-003-0003');
      doc.text('Дата регистрации: 01.04.2026');
      doc.moveDown();
      doc.text('Грузоотправитель: АО «МисмэтчТранс»');
      doc.text('БИН: 111222333444');
      doc.moveDown();
      // ЕСР Атырау (706101), но написано "Алматы"
      doc.text('Станция отправления: Алматы  ЕСР: 706101');
      // ЕСР Павлодара (852102), но написано "Шымкент"
      doc.text('Станция назначения: Шымкент  ЕСР: 852102');
      doc.moveDown();
      doc.text('Наименование груза: Нефть сырая');
      doc.text('Код ЕТСНГ: 211001');
      doc.text('Вид вагона: Цистерна');
      doc.moveDown();
      doc.text('Количество вагонов: 8');
      doc.text('Период: 01.09.2026 — 30.09.2026');
    },
  },

  // 4. Название груза не совпадает с кодом ЕТСНГ
  {
    name: 'BAD_004_etsng_name_mismatch.pdf',
    desc: 'Код ЕТСНГ от пшеницы, а груз — нефть',
    draw(doc) {
      doc.font('Bold').fontSize(14).text('ЗАЯВКА (ПЛАН) НА ПЕРЕВОЗКУ — Форма ГУ-12');
      doc.font('Regular').fontSize(10).moveDown();
      doc.text('№ заявки: ГУ12-BAD-004-0004');
      doc.text('Дата регистрации: 20.03.2026');
      doc.moveDown();
      doc.text('Грузоотправитель: ТОО «ОшибкаТранс»');
      doc.text('БИН: 555666777888');
      doc.moveDown();
      doc.text('Станция отправления: Астана  ЕСР: 802602');
      doc.text('Станция назначения: Алматы-1  ЕСР: 654205');
      doc.moveDown();
      // ЕТСНГ пшеницы, но груз написан как нефть
      doc.text('Наименование груза: Нефть сырая');
      doc.text('Код ЕТСНГ: 011063');   // это пшеница
      doc.text('Вид вагона: Цистерна');
      doc.moveDown();
      doc.text('Количество вагонов: 15');
      doc.text('Период: 01.10.2026 — 31.10.2026');
    },
  },

  // 5. Почти пустой — почти ничего не распознается
  {
    name: 'BAD_005_missing_fields.pdf',
    desc: 'Большинство полей отсутствуют',
    draw(doc) {
      doc.font('Bold').fontSize(14).text('ЗАЯВКА НА ПЕРЕВОЗКУ');
      doc.font('Regular').fontSize(10).moveDown();
      // нет номера ГУ-12, нет дат, нет кодов
      doc.text('Грузоотправитель: ТОО «НеполныеДанные»');
      doc.moveDown();
      doc.text('Маршрут: Астана - Алматы');  // без кодов ЕСР
      doc.moveDown();
      doc.text('Груз: зерно');  // без кода ЕТСНГ
      doc.moveDown();
      doc.text('Вагоны: несколько');  // неразборчивое количество
    },
  },

  // 6. Дубликат существующего
  {
    name: 'BAD_006_duplicate.pdf',
    desc: 'Тот же номер что уже загружен (ГУ12-BULK-001-6924)',
    draw(doc) {
      doc.font('Bold').fontSize(14).text('ЗАЯВКА (ПЛАН) НА ПЕРЕВОЗКУ — Форма ГУ-12');
      doc.font('Regular').fontSize(10).moveDown();
      doc.text('№ заявки: ГУ12-BULK-001-6924');  // дубликат
      doc.text('Дата регистрации: 15.06.2026');
      doc.moveDown();
      doc.text('Грузоотправитель: ТОО «КазАгроЭкспорт»');
      doc.moveDown();
      doc.text('Станция отправления: Шымкент  ЕСР: 668101');
      doc.text('Станция назначения: Тараз  ЕСР: 662109');
      doc.moveDown();
      doc.text('Наименование груза: Подсолнечник');
      doc.text('Код ЕТСНГ: 011079');
      doc.text('Вид вагона: Хоппер');
      doc.moveDown();
      doc.text('Количество вагонов: 16');
      doc.text('Период: 01.12.2026 — 31.12.2026');
    },
  },

  // 7. Совершенно случайный текст, не похожий на ГУ-12
  {
    name: 'BAD_007_random_text.pdf',
    desc: 'Случайный документ — не ГУ-12',
    draw(doc) {
      doc.font('Bold').fontSize(16).text('ДОГОВОР АРЕНДЫ ОФИСА № 42');
      doc.font('Regular').fontSize(10).moveDown();
      doc.text('г. Алматы, 17 июня 2026 года');
      doc.moveDown();
      doc.text('ТОО «АрендаКом», именуемое в дальнейшем «Арендодатель», в лице директора');
      doc.text('Иванова Ивана Ивановича, действующего на основании Устава, с одной стороны,');
      doc.text('и ТОО «СъёмщикПлюс», именуемое в дальнейшем «Арендатор», с другой стороны,');
      doc.text('заключили настоящий договор о нижеследующем:');
      doc.moveDown();
      doc.text('1. Предмет договора: Арендодатель передаёт Арендатору офисное помещение');
      doc.text('   площадью 45 кв.м. по адресу: г. Алматы, ул. Абая 10, офис 305.');
      doc.moveDown();
      doc.text('2. Срок аренды: 12 месяцев с 01.07.2026 по 30.06.2027.');
      doc.moveDown();
      doc.text('3. Арендная плата: 250 000 тенге в месяц, НДС включён.');
    },
  },
];

console.log('Генерируем неправильные тестовые PDF...\n');

for (const c of CASES) {
  const outPath = path.join(OUT_DIR, c.name);
  await makePdf(outPath, c.draw.bind(c));
  console.log(`✓ ${c.name}  —  ${c.desc}`);
}

console.log(`\nГотово! ${CASES.length} PDF в папке: ${OUT_DIR}`);
