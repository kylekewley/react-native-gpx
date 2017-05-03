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
    return new Promise((resolve, reject) => {
      let tracks = this.parsedGPX.find('/ns:gpx/ns:trk/ns:name', GPXDocument.GPX_NS);

      if (tracks === undefined)
        reject("Unable to read track names");

      // Use the map function to get an array with the name of each track if it exists
      resolve(tracks.map((val) => {
        return val === undefined ? 'No Name' : val.text();
      }));
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
