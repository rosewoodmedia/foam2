/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core;

import foam.dao.jdbc.IndexedPreparedStatement;
import foam.nanos.auth.AuthService;
import foam.nanos.auth.AuthorizationException;
import foam.nanos.logger.Logger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.Signature;
import java.security.SignatureException;
import java.sql.SQLException;
import java.util.Map;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;

public abstract class AbstractPropertyInfo
  implements PropertyInfo
{
  protected ClassInfo parent;

  @Override
  public PropertyInfo setClassInfo(ClassInfo p) {
    parent = p;
    return this;
  }

  @Override
  public ClassInfo getClassInfo() {
    return parent;
  }

  @Override
  public void toJSON(foam.lib.json.Outputter outputter, Object value) {
    outputter.output(value);
  }

  @Override
  public void toXML(foam.lib.xml.Outputter outputter, Object value) {
    outputter.output(value);
  }

  @Override
  public foam.mlang.Expr partialEval() {
    return this;
  }

  @Override
  public void prepareStatement(IndexedPreparedStatement stmt) throws SQLException {}

  @Override
  public Object f(Object o) {
    return get(o);
  }

  @Override
  public void diff(FObject o1, FObject o2, Map diff, PropertyInfo prop) {
    if ( prop.compare(o1, o2) != 0 ) {
      diff.put(prop.getName(), prop.f(o2));
    }
  }

  public int compareTo(Object obj) {
    int result = getName().compareTo(((PropertyInfo)obj).getName());
    return result != 0 ? result : getClassInfo().compareTo(((PropertyInfo)obj).getClassInfo());
  }

  @Override
  public boolean hardDiff(FObject o1, FObject o2, FObject diff){
    // compare the property value of o1 and o2
    // If value is Object reference, only compare reference. (AbstractObjectPropertyInfo will override hardDiff method)
    // use to compare String and primitive type
    int same = comparePropertyToValue(this.get(o1), this.get(o2));
    //return the value of o2 if o1 and o2 are different
    if ( same != 0 ) {
      //set o2 prop into diff
      this.set(diff, this.get(o2));
      return true;
    } else {
      //return null if o1 and o2 are same
      return false;
    }
  }

  public void setFromString(Object obj, String value) {
    this.set(obj, fromString(value));
  }

  @Override
  public Object fromXML(X x, XMLStreamReader reader) {
    // Moves reader to characters state in order for value reading for various data types (date, boolean, short ...)
    try {
      reader.next();
    } catch (XMLStreamException ex) {
      Logger logger = (Logger) x.get("logger");
      logger.error("Premature end of XML file");
    }
    return "";
  }

  @Override
  public void setStatementValue(IndexedPreparedStatement stmt, FObject o) throws java.sql.SQLException {
    stmt.setObject(this.get(o));
  }

  @Override
  public void setFromResultSet(java.sql.ResultSet resultSet, int index, FObject o) throws java.sql.SQLException{
    this.set(o, resultSet.getObject(index));
  }

  public String toString() {
    // TODO: generate static string in generated instances instead to avoid creating garbage.
    return parent.getId() + "." + getName();
  }

  @Override
  public void cloneProperty(FObject source, FObject dest) {
    set(dest, foam.util.SafetyUtil.deepClone(get(source)));
  }

  @Override
  public void validate(X x, FObject obj) throws IllegalStateException {}

  @Override
  public boolean includeInDigest() {
    return true;
  }

  @Override
  public void updateDigest(FObject obj, MessageDigest md) {}

  @Override
  public boolean includeInSignature() {
    return true;
  }

  @Override
  public boolean containsPII(){
    return false;
  }

  @Override
  public boolean containsDeletablePII(){
    return false;
  }

  @Override
  public void authorize(X x) {
    // Since MLangs don't write values, we only need to check if the property
    // requires a read permission here.
    if ( this.getReadPermissionRequired() ) {
      AuthService auth = (AuthService) x.get("auth");
      String simpleName = this.getClassInfo().getObjClass().getSimpleName();

      String simpleNameLower = simpleName.toLowerCase();
      String nameLower = this.getName().toLowerCase();
      
      if ( ! auth.check(x, simpleNameLower + ".ro." + nameLower) && ! auth.check(x, simpleNameLower + ".rw." + nameLower)) {
        throw new AuthorizationException(String.format("Access denied. User lacks permission to access property '%s' on model '%s'.", this.getName(), simpleName));
      };
    }
  }

  @Override
  public void updateSignature(FObject obj, Signature sig) throws SignatureException {}

  protected byte[] nameAsByteArray_ = null;

  @Override
  public byte[] getNameAsByteArray() {
    if ( nameAsByteArray_ == null ) {
      nameAsByteArray_ = getName().getBytes(StandardCharsets.UTF_8);
    }
    return nameAsByteArray_;
  }
}
