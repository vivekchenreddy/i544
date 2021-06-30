/** Immutable application error object.  Will always have a message
 *  property containing error message; will have an options property;
 *  may also have code and widget properties.
 */
export class AppError {

  //options can specify code, widget and any other properties
  constructor(msg, options={}) {
    this._msg = msg;
    this._options = options;
    Object.freeze(this);
  }

  get message() {
    const codePrefix =
      (this.code) ? `${this._options.code}: ` : '';
    return `${codePrefix}${this._msg}`;
  }

  get options() { return this._options; }

  get code() { return this._options.code ?? ''; }
  get widget() { return this._options.widget ?? ''; }
  
}

