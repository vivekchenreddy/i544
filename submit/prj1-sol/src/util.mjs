export class AppError {

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


