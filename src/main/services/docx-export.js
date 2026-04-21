const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, HeadingLevel } = require('docx');

async function exportProjectToDocx({ project, sections, exportsDir }) {
  if (!project) {
    throw new Error('Proiect invalid pentru export.');
  }

  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  const children = [
    new Paragraph({
      text: project.title,
      heading: HeadingLevel.TITLE
    })
  ];

  sections.forEach((section) => {
    children.push(
      new Paragraph({
        text: section.title,
        heading: HeadingLevel.HEADING_1
      })
    );

    const blocks = (section.content || '')
      .split(/\n+/)
      .map((row) => row.trim())
      .filter(Boolean);

    if (blocks.length === 0) {
      children.push(new Paragraph({ text: '' }));
      return;
    }

    blocks.forEach((block) => {
      children.push(new Paragraph({ text: block }));
    });
  });

  const doc = new Document({
    sections: [{ children }]
  });

  const buffer = await Packer.toBuffer(doc);
  const safeTitle = project.title.replace(/[^a-z0-9-_ ]/gi, '').trim() || 'proiect';
  const fileName = `${safeTitle}-${Date.now()}.docx`;
  const filePath = path.join(exportsDir, fileName);
  fs.writeFileSync(filePath, buffer);

  return filePath;
}

module.exports = {
  exportProjectToDocx
};
