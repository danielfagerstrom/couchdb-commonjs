/**
 * Wrapper for built-in http.js to emulate the browser XMLHttpRequest object.
 *
 * This can be used with JS designed for browsers to improve reuse of code and
 * allow the use of existing libraries.
 *
 * Usage: include("XMLHttpRequest.js") and use XMLHttpRequest per W3C specs.
 *
 * @todo SSL Support
 * @author Dan DeFelippi <dan@driverdan.com>
 * @license MIT
 */
 
var 
  http = require("http");

exports.XMLHttpRequest = function() {
  /**
   * Private variables
   */
  var self = this;

  // Holds http.js objects
  var 
    request,
    response,
    settings = {},
    client,
    defaultHeaders = {
      "User-Agent": "node.js",
      "Accept": "*/*",
    },
    headers = defaultHeaders;;

  /**
   * Constants
   */
  this.UNSENT = 0;
  this.OPENED = 1;
  this.HEADERS_RECEIVED = 2;
  this.LOADING = 3;
  this.DONE = 4;

  /**
   * Public vars
   */
  // Current state
  this.readyState = this.UNSENT;

  // Result & response
  this.responseText = "";
  this.responseXML = "";
  this.status = null;
  this.statusText = null;

  /**
   * Open the connection. Currently supports local server requests.
   *
   * @param string method Connection method (eg GET, POST)
   * @param string url URL for the connection.
   * @param boolean async Asynchronous connection. Default is true.
   * @param string user Username for basic authentication (optional)
   * @param string password Password for basic authentication (optional)
   */
  this.open = function(method, url, async, user, password) {
    settings = {
      "method": method,
      "url": url,
      "async": async,
      "user": user,
      "password": password
    };

    this.abort();

    setState(this.OPENED);
  };

  /**
   * Sets a header for the request.
   *
   * @param string header Header name
   * @param string value Header value
   */
  this.setRequestHeader = function(header, value) {
    headers[header] = value;
  };

  /**
   * Gets a header from the server response.
   *
   * @param string header Name of header to get.
   * @return string Text of the header or null if it doesn't exist.
   */
  this.getResponseHeader = function(header) {
    if (this.readyState > this.OPENED && response.headers.header) {
      return header + ": " + response.headers.header;
    }

    return null;
  };

  /**
   * Gets all the response headers.
   *
   * @return string 
   */
  this.getAllResponseHeaders = function() {
    if (this.readyState < this.HEADERS_RECEIVED) {
      throw "INVALID_STATE_ERR: Headers have not been received.";
    }
    var result = "";

    for (var i in response.headers) {
      result += i + ": " + response.headers[i] + "\r\n";
    }
    return result.substr(0, result.length - 2);
  };

  /**
   * Sends the request to the server.
   *
   * @param string data Optional data to send as request body.
   */
  this.send = function(data) {
    if (this.readyState != this.OPENED) {
      throw "INVALID_STATE_ERR: connection must be opened before send() is called";
    }

    /**
    setState(this.OPENED);

     * Figure out if a host and/or port were specified.
     * Regex borrowed from parseUri and modified. Needs additional optimization.
     * @see http://blog.stevenlevithan.com/archives/parseuri
     */
    var loc = /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?([^?#]*)/.exec(settings.url);

    // Determine the server
    switch (loc[1]) {
      case 'http':
        var host = loc[6];
        break;

      case undefined:
      case '':
        var host = "localhost";
        break;

      case 'https':
        throw "SSL is not implemented.";
        break;

      default:
        throw "Protocol not supported.";
    }

    // Default to port 80. If accessing localhost on another port be sure to
    // use http://localhost:port/path
    var port = loc[7] ? loc[7] : 80;

    // Set the URI, default to /
    var uri = loc[8] ? loc[8] : "/";
    
    if (settings.url.indexOf("?") !== -1) {
      uri += settings.url.substring(settings.url.indexOf("?"));
    }

    // Set the Host header or the server may reject the request
    headers["Host"] = host;

    client = http.createClient(port, host);

    // Set content length header
    if (settings.method == "GET" || settings.method == "HEAD") {
      data = null;
    } else if (data) {
      headers["Content-Length"] = data.length;

      if (!headers["Content-Type"]) {
        headers["Content-Type"] = "text/plain;charset=UTF-8";
      }
    }

    // Use the correct request method
    switch (settings.method) {
      case 'GET':
        request = client.request("GET", uri, headers);
        break;

      case 'POST':
        request = client.request("POST", uri, headers);
        break;

      case 'HEAD':
        request = client.head(uri, headers);
        break;

      case 'PUT':
        request = client.request("PUT", uri, headers);
        break;

      case 'DELETE':
        request = client.request("DELETE", uri, headers);
        break;

      default:
        throw "Request method is unsupported.";
    }

    // Send data to the server
    if (data) {
      request.write(data);
    }

    request.addListener("response", function(resp) {
      response = resp;
      response.setEncoding("utf8");

      setState(this.HEADERS_RECEIVED);

      self.status = response.statusCode;

      response.addListener("data", function(chunk) {
        if (chunk) {
          self.responseText += chunk;
        }
        setState(self.LOADING);
      });

      response.addListener("end", function() {
        setState(self.DONE);
      });
    });
    request.end();
  };

  /**
   * Aborts a request.
   */
  this.abort = function() {
    headers = defaultHeaders;
    this.readyState = this.UNSENT;
    this.responseText = "";
    this.responseXML = "";
  };

  /**
   * Changes readyState and calls onreadystatechange.
   *
   * @param int state New state
   */
  var setState = function(state) {
    self.readyState = state;
    self.onreadystatechange && self.onreadystatechange();
  }
};
