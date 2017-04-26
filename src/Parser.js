var libxmljs = require("libxmljs");


export default class Parser {
  constructor() {
    this.parsedXML = undefined;
  }

  /**
   * Parse the xml string and store the results internally
   * @param {string} xmlString The xml string to parse
   */
  parseXMLString(xmlString) {
    this.parsedXML = libxmljs.parseXmlString(xmlString, {recover: true});
    return this.parsedXML;
  }
}
