// mongoose 5's isValidObjectId accepts any 12-char string, which would still
// throw a CastError inside $in, so check the hex form directly
const OBJECT_ID = /^[0-9a-f]{24}$/i;

// a posted id is only usable as a plain 24-hex string. anything else, an
// object like id[$ne]=x included, would reach Mongoose as a query operator
function isObjectId(value) {
  return typeof value === "string" && OBJECT_ID.test(value);
}

module.exports = { OBJECT_ID, isObjectId };
