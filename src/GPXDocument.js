var libxmljs = require("libxmljs");

export default class GPXDocument {

  /**
   * Parse the gpx xml string and store the results internally
   * @param {string} xmlString The xml string to parse
   */
  constructor(xmlString) {
    this.parsedGPX = libxmljs.parseXmlString(xmlString, {recover: true});
  }

  /**
   * Get the track names for all tracks in the gpx file
   */
  getTrackNames() {
    if (this.parsedGPX === undefined) {
      return [];
    }

    return this.parsedGPX.find('/ns:gpx/ns:trk/ns:name', GPXDocument.GPX_NS).map((val) => {
      if (val) return val.text();
      return 'No Name';
    });

  }

  /**
   * Get the node's text value or return the default text value if the
   * node does not exist
   */
  _getTextOrDefault(node, xpath, defaultValue) {
    var search = node.get(xpath);

    return search === null ? defaultValue : search.text();
  }
}

// The mean radius of the earth in miles
GPXDocument.MEAN_RAD_MI = 3958.7613;
GPXDocument.GPX_NS = { ns: 'http://www.topografix.com/GPX/1/1' };
