const fs = require('fs');
const path = require('path');

class ObservationReporter {
  constructor(options = {}) {
    this.outputDir = options.outputDir ?? '.';
  }

  onTestEnd(test, result) {
    const attachment = result.attachments.find((item) => item.name === 'observation');
    if (!attachment?.body) {
      return;
    }

    const body = Buffer.isBuffer(attachment.body)
      ? attachment.body
      : Buffer.from(attachment.body);

    fs.writeFileSync(
      path.join(this.outputDir, `${test.title}.observation.json`),
      body,
    );
  }
}

module.exports = ObservationReporter;
