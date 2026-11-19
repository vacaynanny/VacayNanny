"""Render the review draft from one content source; never upload or send it."""
import json
from pathlib import Path
from xml.sax.saxutils import escape

from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/agreements'
OUT.mkdir(parents=True, exist_ok=True)
CONTENT = json.loads((ROOT / 'docs/legal/nanny-agreement-draft.json').read_text())
NAVY = colors.HexColor('#17324D')
CORAL = colors.HexColor('#C45644')
SAGE = colors.HexColor('#EDF1E8')
LINE = colors.HexColor('#DCE2DA')
WIDTH = A4[0] - 104

font_root = Path('/usr/share/fonts/truetype/liberation2')
if font_root.exists():
    for name, filename in [('Body', 'LiberationSans-Regular.ttf'), ('BodyBold', 'LiberationSans-Bold.ttf'), ('Heading', 'LiberationSerif-Regular.ttf')]:
        pdfmetrics.registerFont(TTFont(name, str(font_root / filename)))
else:
    for name, standard in [('Body', 'Helvetica'), ('BodyBold', 'Helvetica-Bold'), ('Heading', 'Times-Roman')]:
        pdfmetrics.registerFont(pdfmetrics.Font(name, standard, 'WinAnsiEncoding'))

STYLES = {
    'title': ParagraphStyle('Title', fontName='Heading', fontSize=26, leading=29, textColor=NAVY, spaceAfter=14),
    'subtitle': ParagraphStyle('Subtitle', fontName='Body', fontSize=11, leading=16, textColor=CORAL, spaceAfter=14),
    'heading': ParagraphStyle('Heading', fontName='BodyBold', fontSize=11, leading=15, textColor=NAVY, spaceBefore=9, spaceAfter=6, keepWithNext=True),
    'body': ParagraphStyle('Body', fontName='Body', fontSize=10.2, leading=14.2, textColor=NAVY, spaceAfter=9),
    'bullet': ParagraphStyle('Bullet', fontName='Body', fontSize=10.2, leading=14.2, textColor=NAVY, leftIndent=13, firstLineIndent=-11, spaceAfter=8),
    'label': ParagraphStyle('Label', fontName='BodyBold', fontSize=9.4, leading=12.8, textColor=NAVY),
    'value': ParagraphStyle('Value', fontName='Body', fontSize=9.6, leading=13, textColor=NAVY),
    'notice': ParagraphStyle('Notice', fontName='BodyBold', fontSize=9, leading=13, textColor=NAVY),
}


def para(value, style='body'):
    return Paragraph(escape(value).replace('\n', '<br/>'), STYLES[style])


def page_frame(canvas, document):
    canvas.saveState()
    canvas.setFillColor(CORAL)
    canvas.circle(57, 805, 3.5, fill=1, stroke=0)
    canvas.setStrokeColor(CORAL)
    for x1, y1, x2, y2 in [(57, 812, 57, 816), (57, 798, 57, 794), (50, 805, 46, 805), (64, 805, 68, 805)]:
        canvas.line(x1, y1, x2, y2)
    canvas.setFillColor(NAVY)
    canvas.setFont('Heading', 17)
    canvas.drawString(77, 800, 'VacayNanny.')
    canvas.setFont('Body', 8)
    canvas.drawRightString(A4[0] - 52, 803, 'DRAFT FOR REVIEW')
    canvas.setStrokeColor(LINE)
    canvas.line(52, 785, A4[0] - 52, 785)
    canvas.line(52, 44, A4[0] - 52, 44)
    canvas.setFont('Body', 8)
    canvas.drawString(52, 29, 'Draft v0.1  •  18 November 2026  •  Complete and review before use')
    canvas.drawRightString(A4[0] - 52, 29, str(document.page))
    canvas.restoreState()


def pdf_blocks(blocks):
    result = []
    for block in blocks:
        kind = block['type']
        if kind in ('heading', 'paragraph'):
            result.append(para(block['text'], 'heading' if kind == 'heading' else 'body'))
        elif kind == 'bullets':
            result.extend(para('• ' + item, 'bullet') for item in block['items'])
        elif kind == 'fields':
            rows = [[para(label, 'label'), para(value, 'value')] for label, value in block['rows']]
            table = Table(rows, colWidths=[WIDTH * .34, WIDTH * .66], hAlign='LEFT')
            table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BACKGROUND', (0, 0), (0, -1), SAGE),
                ('LINEBELOW', (0, 0), (-1, -1), .5, LINE),
                ('LEFTPADDING', (0, 0), (-1, -1), 9),
                ('RIGHTPADDING', (0, 0), (-1, -1), 9),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ]))
            result.extend([table, Spacer(1, 9)])
        elif kind == 'notice':
            table = Table([[para(block['text'], 'notice')]], colWidths=[WIDTH])
            table.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), SAGE), ('BOX', (0, 0), (-1, -1), .5, LINE), ('TOPPADDING', (0, 0), (-1, -1), 9), ('BOTTOMPADDING', (0, 0), (-1, -1), 9), ('LEFTPADDING', (0, 0), (-1, -1), 10), ('RIGHTPADDING', (0, 0), (-1, -1), 10)]))
            result.extend([table, Spacer(1, 10)])
        else:
            raise ValueError('Unsupported agreement block: ' + kind)
    return result


def make_pdf(path, pages):
    story = []
    for index, page in enumerate(pages):
        if index:
            story.append(PageBreak())
        story.append(para(page['title'], 'title'))
        if page.get('subtitle'):
            story.append(para(page['subtitle'], 'subtitle'))
        story.extend(pdf_blocks(page['blocks']))
    SimpleDocTemplate(str(path), pagesize=A4, leftMargin=52, rightMargin=52, topMargin=76, bottomMargin=60, title='VacayNanny Nanny Agreement — Draft for Review', author='VacayNanny', pageCompression=1).build(story, onFirstPage=page_frame, onLaterPages=page_frame)


def make_docx(path, pages):
    document = Document()
    section = document.sections[0]
    section.page_width, section.page_height = Inches(8.27), Inches(11.69)
    section.top_margin, section.bottom_margin = Inches(.9), Inches(.8)
    section.left_margin = section.right_margin = Inches(.73)
    normal = document.styles['Normal']
    normal.font.name = 'Liberation Sans'
    normal.font.size = Pt(10)
    normal.font.color.rgb = RGBColor.from_string('17324D')
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.06
    for name in ['Title', 'Heading 1']:
        document.styles[name].font.name = 'Liberation Serif'
        rfonts = document.styles[name].element.get_or_add_rPr().get_or_add_rFonts()
        for attribute in ['asciiTheme', 'hAnsiTheme', 'eastAsiaTheme', 'cstheme']:
            rfonts.attrib.pop(qn('w:' + attribute), None)
        document.styles[name].font.color.rgb = RGBColor.from_string('17324D')
    document.styles['Title'].font.size = Pt(24)
    document.styles['Heading 1'].font.size = Pt(12)
    document.styles['Heading 1'].paragraph_format.keep_with_next = True
    header = section.header.paragraphs[0]
    header.text = 'VacayNanny.                                      DRAFT FOR REVIEW'
    header.style = document.styles['Caption']
    for run in header.runs:
        run.font.color.rgb = RGBColor.from_string('17324D')
        run.bold = False
    footer = section.footer.paragraphs[0]
    footer.text = 'Draft v0.1 • 18 November 2026 • Complete and review before use     '
    field = OxmlElement('w:fldSimple')
    field.set(qn('w:instr'), 'PAGE')
    footer._p.append(field)
    for index, page in enumerate(pages):
        if index:
            document.add_page_break()
        document.add_paragraph(page['title'], 'Title')
        if page.get('subtitle'):
            document.add_paragraph(page['subtitle'], 'Subtitle')
        for block in page['blocks']:
            kind = block['type']
            if kind == 'heading':
                document.add_paragraph(block['text'], 'Heading 1')
            elif kind in ('paragraph', 'notice'):
                paragraph = document.add_paragraph(block['text'])
                if kind == 'notice':
                    for run in paragraph.runs:
                        run.bold = True
            elif kind == 'bullets':
                for item in block['items']:
                    document.add_paragraph(item, 'List Bullet')
            elif kind == 'fields':
                table = document.add_table(rows=0, cols=2)
                table.style = 'Table Grid'
                borders = OxmlElement('w:tblBorders')
                for edge in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']:
                    border = OxmlElement('w:' + edge)
                    border.set(qn('w:val'), 'single' if edge in ['bottom', 'insideH'] else 'nil')
                    border.set(qn('w:sz'), '4')
                    border.set(qn('w:color'), 'DCE2DA')
                    borders.append(border)
                table._tbl.tblPr.append(borders)
                for label, value in block['rows']:
                    row = table.add_row()
                    row.cells[0].text, row.cells[1].text = label, value
                    row.cells[0].width, row.cells[1].width = Inches(2.1), Inches(4.6)
                    shade = OxmlElement('w:shd')
                    shade.set(qn('w:fill'), 'EDF1E8')
                    row.cells[0]._tc.get_or_add_tcPr().append(shade)
                    for cell in row.cells:
                        for paragraph in cell.paragraphs:
                            paragraph.paragraph_format.space_after = Pt(3)
                            paragraph.paragraph_format.line_spacing = 1.05
                            for run in paragraph.runs:
                                run.font.size = Pt(9.5)
                                run.font.name = 'Liberation Sans'
                                run.font.color.rgb = RGBColor.from_string('17324D')
                                run.bold = False
                    for run in row.cells[0].paragraphs[0].runs:
                        run.bold = True
                    no_split = OxmlElement('w:cantSplit')
                    row._tr.get_or_add_trPr().append(no_split)
                document.add_paragraph('')
            else:
                raise ValueError('Unsupported agreement block: ' + kind)
    document.core_properties.title = 'VacayNanny Nanny Agreement — Draft for Review'
    document.core_properties.subject = 'Proposed participation, conduct and commercial terms for review'
    document.save(path)


base = 'VacayNanny_Nanny_Code_of_Conduct_and_Marketplace_Participation_Agreement_DRAFT'
make_pdf(OUT / (base + '.pdf'), CONTENT['pages'])
make_docx(OUT / (base + '.docx'), CONTENT['pages'])
review = CONTENT['review']
notes = [{'title': review['title'], 'blocks': [
    {'type': 'notice', 'text': 'Internal review notes — not part of the nanny agreement and not a legal approval.'},
    {'type': 'heading', 'text': 'Decisions to complete before issue'},
    {'type': 'bullets', 'items': review['open_decisions']},
]}, {'title': 'References for review', 'blocks': [
    {'type': 'paragraph', 'text': 'These sources inform review of the proposed safeguards. They do not establish that the agreement or operating model complies with every applicable law.'},
] + [block for source in review['sources'] for block in [
    {'type': 'heading', 'text': source['title']},
    {'type': 'paragraph', 'text': source['note']},
    {'type': 'paragraph', 'text': source['url']},
]]}]
make_pdf(OUT / 'VacayNanny_Agreement_Review_Notes.pdf', notes)
print('Created draft PDF, editable DOCX and separate review notes under artifacts/agreements/. No agreement was uploaded or emailed.')
