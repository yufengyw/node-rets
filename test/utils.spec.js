const { expect } = require('chai');
const sinon = require('sinon');

const utils = require('../lib/utils.js');
const { DEFAULTS } = require('../lib/constants.js');
const log = require('../lib/logger.js');
const helpers = require('./helpers.js');

const { md5 } = utils;

const uaHeader = function(userAgent, userAgentPassword, sessionId, retsVersion) {
  const a1 = md5([
    userAgent,
    userAgentPassword,
  ].join(':'));
  const retsUaAuth = md5([
    a1,
    '',
    sessionId,
    retsVersion,
  ].join(':'));
  return `Digest ${retsUaAuth}`;
};

const configuration = {
  username: 'username',
  password: 'password',
};
const cookies = {
  'sample-coolie': 'sample-value',
};
const sessionId = '1234567890';

const expectedResponse = {
  auth: 'digest',
  username: configuration.username,
  password: configuration.password,
  cookies,
  headers: {
    'RETS-Version': DEFAULTS.RETS_VERSION,
    'User-Agent': DEFAULTS.USER_AGENT,
  },
  parse_response: false,
};

describe('Utils', function() {
  afterEach(function() {
    sinon.restore();
  });

  beforeEach(function() {
    sinon.stub(log);
  });

  describe('#md5', function() {
    it('should produce a valid md5 string', function() {
      const result = utils.md5('abc');
      expect(result).to.eq('900150983cd24fb0d6963f7d28e17f72');
    });
  });

  describe('#KeyValueStringToObject', function() {
    context('when nothing passed in', function() {
      it('returns empty object', function() {
        const result = utils.KeyValueStringToObject();
        expect(result).to.deep.eq({});
      });
    });

    context('when a simple string', function() {
      it('returns the correct object', function() {
        const result = utils.KeyValueStringToObject('a=b');
        expect(result).to.deep.eq({ a: 'b' });
      });
    });

    context('when no equal symbol', function() {
      it('returns the correct object', function() {
        const result = utils.KeyValueStringToObject('ab');
        expect(result).to.deep.eq({ ab: undefined });
      });
    });
  });

  describe('#KeyValueStringsToObject', function() {
    context('when nothing passed in', function() {
      it('returns empty object', function() {
        const result = utils.KeyValueStringsToObject();
        expect(result).to.deep.eq({});
      });
    });

    context('when a string with new lines', function() {
      it('returns the correct object', function() {
        const result = utils.KeyValueStringsToObject('a=b\nc=d');
        expect(result).to.deep.eq({ a: 'b', c: 'd' });
      });
    });
  });

  describe('#GetRetsResponseFromBody', function() {
    context('when a valid xml string', function() {
      it('returns the response text', function() {
        const result = utils.GetRetsResponseFromBody('<RETS><RETS-RESPONSE>Body Text</RETS-RESPONSE></RETS>');
        expect(result).to.eq('Body Text');
      });
    });

    context('when an invalid xml string', function() {
      it('throws an error', function() {
        const fn = () => {
          utils.GetRetsResponseFromBody('Invalid XML');
        };
        expect(fn).to.throw('Unable to parse XML');
      });
    });

    context('when an xml does not contain rets response', function() {
      it('throws an error', function() {
        const fn = () => {
          utils.GetRetsResponseFromBody('<html><body></body></html>');
        };
        expect(fn).to.throw('Unable to find RETS-RESPONSE');
      });
    });
  });

  describe('#GetRetsSessionIdFromCookies', function() {
    context('when not an object', function() {
      it('returns null', function() {
        const result = utils.GetRetsSessionIdFromCookies('not an object');
        expect(result).to.eq(null);
      });
    });

    context('when the RETS-Session-ID cookie does not exist', function() {
      it('returns null', function() {
        const result = utils.GetRetsSessionIdFromCookies({ 'Item 1': 'hello' });
        expect(result).to.eq(null);
      });
    });

    context('when the RETS-Session-ID cookie does exist', function() {
      it('returns the session id', function() {
        const result = utils.GetRetsSessionIdFromCookies({ 'RETS-Session-ID': '1234567890; Path=/' });
        expect(result).to.eq('1234567890');
      });
    });
  });

  describe('#GetRetsMethodURLsFromBody', function() {
    it('build the correct object', function() {
      const body = {
        Action: 'ActionURL',
        ChangePassword: 'ChangePasswordURL',
        GetObject: 'GetObjectURL',
        Login: 'LoginURL',
        LoginComplete: 'LoginCompleteURL',
        Logout: 'LogoutURL',
        Search: 'SearchURL',
        GetMetadata: 'GetMetadataURL',
        Update: 'UpdateURL',
      };
      const expected = {
        ACTION: 'ActionURL',
        CHANGE_PASSWORD: 'ChangePasswordURL',
        GET_OBJECT: 'GetObjectURL',
        LOGIN: 'LoginURL',
        LOGIN_COMPLETE: 'LoginCompleteURL',
        LOGOUT: 'LogoutURL',
        SEARCH: 'SearchURL',
        GET_METADATA: 'GetMetadataURL',
        UPDATE: 'UpdateURL',
      };
      const result = utils.GetRetsMethodURLsFromBody(body);
      expect(result).to.deep.eq(expected);
    });
  });

  describe('#BuildRetsRequestParams', function() {
    context('when no cookies and no sessionId', function() {
      it('should build the correct params', function() {
        const result = utils.BuildRetsRequestParams(configuration);
        expect(result).to.deep.eq({
          ...expectedResponse,
          headers: {
            'RETS-Version': DEFAULTS.RETS_VERSION,
            'User-Agent': DEFAULTS.USER_AGENT,
          },
          cookies: {},
        });
      });
    });

    context('when passing in cookies and sessionId', function() {
      it('should build a thing', function() {
        const result = utils.BuildRetsRequestParams(
          configuration,
          cookies,
          sessionId,
        );
        expect(result).to.deep.eq(expectedResponse);
      });
    });

    context('when userAgentPassword', function() {
      it('should build a thing', function() {
        const userAgentPassword = '123456';
        const result = utils.BuildRetsRequestParams(
          {
            ...configuration,
            userAgentPassword,
          },
          cookies,
        );
        expect(result).to.deep.eq({
          ...expectedResponse,
          headers: {
            ...expectedResponse.headers,
            'RETS-UA-Authorization': uaHeader(DEFAULTS.USER_AGENT, userAgentPassword, undefined, DEFAULTS.RETS_VERSION),
          },
        });
      });
    });
  });

  describe('#ParseRetsMetadata', function() {
    context('when an array of elements', function() {
      it('returns a parsed JSON', async function() {
        const result = await utils.ParseRetsMetadata(helpers.data.metadataClassXML);
        expect(result).to.deep.eq(helpers.data.metadataClassJSON);
      });
    });

    context('when no metadata root element', function() {
      it('throws an error', async function() {
        const metadataContent = '<?xml version="1.0" ?><RETS ReplyCode="0" ReplyText="V2.6.0 761: Success"><METADATA></METADATA></RETS>';
        const result = await utils.ParseRetsMetadata(metadataContent).catch(e => e);
        expect(result).to.be.an('error');
      });
    });

    context('when multiple root elements', function() {
      it('return an array of elements', async function() {
        const metadataContent = `<?xml version="1.0" ?>
        <RETS ReplyCode="0" ReplyText="V2.6.0 761: Success">
          <METADATA>
            <METADATA-CLASS Resource="Property">
              <Class>
                <ClassName>ALL</ClassName>
              </Class>
            </METADATA-CLASS>
            <METADATA-CLASS Resource="Fake">
              <Class>
                <ClassName>ALL</ClassName>
              </Class>
            </METADATA-CLASS>
          </METADATA>
        </RETS>`;
        const result = await utils.ParseRetsMetadata(metadataContent);
        expect(result).to.have.lengthOf(2);
      });
    });
  });

  describe('#ParseRetsQuery', function() {
    const queryContentSimplified = `<?xml version="1.0" ?>
    <RETS ReplyCode="0" ReplyText="V2.6.0 761: Success">
      <REData>
        <Properties>
          <AllProperty>
            <Property>
              <Address>
                <DisplayStreetNumber>410</DisplayStreetNumber>
              </Address>
              <Lot>
                <Description>
                  <LotAcreage>1.36</LotAcreage>
                </Description>
              </Lot>
            </Property>
          </AllProperty>
        </Properties>
      </REData>
    </RETS>`;

    context('when processing query xml', function() {
      it('generates a json object', async function() {
        const result = await utils.ParseRetsQuery(helpers.data.propertiesXML, 'Property');
        expect(result).to.deep.eq(helpers.data.propertiesJSON);
      });
    });

    context('when a single object', function() {
      it('generates an array', async function() {
        const result = await utils.ParseRetsQuery(queryContentSimplified, 'Property');
        expect(result.Objects).to.be.an('array');
        expect(result.Objects).to.have.lengthOf(1);
        expect(result).not.to.have.property('TotalCount');
      });
    });

    context('when it the nested property can not be found', function() {
      it('returns the REData element', async function() {
        const result = await utils.ParseRetsQuery(queryContentSimplified, 'UnknownType');
        expect(result.Objects[0]).to.deep.eq({
          Properties: {
            AllProperty: {
              Property: {
                Address: {
                  DisplayStreetNumber: '410',
                },
                Lot: {
                  Description: {
                    LotAcreage: '1.36',
                  },
                },
              },
            },
          },
        });
      });
    });

    context('when pass in flatten', function() {
      it('returns a flatten object', async function() {
        const result = await utils.ParseRetsQuery(queryContentSimplified, 'Property', true);
        expect(result.Objects[0]).to.deep.eq({
          DisplayStreetNumber: '410',
          LotAcreage: '1.36',
        });
      });
    });

    context('when not a REData xml', function() {
      it('returns an empty array', async function() {
        const result = await utils.ParseRetsQuery(helpers.data.metadataClassXML, 'Property');
        expect(result).to.deep.eq({
          Count: 0,
          Objects: [],
        });
      });
    });
  });

  describe('#ParseRetsResponseXML', function() {
    const xmlContent = `<?xml version="1.0" ?>
    <RETS ReplyCode="0" ReplyText="V2.6.0 761: Success">
      <REData>
        <Properties>
          <AllProperty>
            <Property>
              <Address>
                <DisplayStreetNumber>410</DisplayStreetNumber>
              </Address>
              <Lot>
                <Description>
                  <LotAcreage>1.36</LotAcreage>
                </Description>
              </Lot>
            </Property>
          </AllProperty>
        </Properties>
      </REData>
    </RETS>`;

    context('when valid XML content', function() {
      it('returns an valid object', async function() {
        const result = await utils.ParseRetsResponseXML(xmlContent);
        expect(result).to.deep.eq({
          $: {
            ReplyCode: '0',
            ReplyText: 'V2.6.0 761: Success',
          },
          REData: {
            Properties: {
              AllProperty: {
                Property: {
                  Address: {
                    DisplayStreetNumber: '410',
                  },
                  Lot: {
                    Description: {
                      LotAcreage: '1.36',
                    },
                  },
                },
              },
            },
          },
        });
      });
    });

    context('when no RETS element exist', function() {
      it('returns the root element', async function() {
        const xmlContentSimple = `<?xml version="1.0" ?>
        <TopLevel><Name>Sample Name</Name></TopLevel>`;

        const result = await utils.ParseRetsResponseXML(xmlContentSimple).catch(e => e);
        expect(result).to.deep.eq({
          TopLevel: {
            Name: 'Sample Name',
          },
        });
      });
    });

    context('when no content passed in', function() {
      it('returns null', async function() {
        const result = await utils.ParseRetsResponseXML('').catch(e => e);
        expect(result).to.eq(null);
      });
    });

    context('when not XML content', function() {
      it('throws an error', async function() {
        const result = await utils.ParseRetsResponseXML('Invalid XML Content').catch(e => e);
        expect(result).to.be.an('error');
      });
    });

    context('when XML is a known error', function() {
      it('throws an known error', async function() {
        const errorXML = `<?xml version="1.0" ?>
        <RETS ReplyCode="20502" ReplyText="V2.6.0 761: Unknown id for METADATA-CLASS: PropertySample">
        </RETS>`;
        const result = await utils.ParseRetsResponseXML(errorXML).catch(e => e);
        expect(result).to.be.an('error');
        expect(result.message).to.match(/20502: Invalid Identifier/);
      });
    });

    context('when XML is an unknown error', function() {
      it('throws an known error', async function() {
        const errorXML = `<?xml version="1.0" ?>
        <RETS ReplyCode="3333" ReplyText="Unknown error code">
        </RETS>`;
        const result = await utils.ParseRetsResponseXML(errorXML).catch(e => e);
        expect(result).to.be.an('error');
        expect(result.message).to.match(/An error occurred/);
      });
    });
  });
});
