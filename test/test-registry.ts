import * as assert from 'assert';
import * as lib from '../src/registry';

import { types, unknownTypes } from './tested-types';
import { Fuzzer, fuzzContext } from '../src';
import * as t from 'io-ts';

describe('registry', () => {
  const fuzzStr1: Fuzzer<string, unknown, t.StringType> = {
    id: 'StringType',
    idType: 'tag',
    impl: {
      type: 'fuzzer',
      func: n => {
        return `Hello ${n}`;
      },
    },
  };
  const fuzzNum: Fuzzer<number, unknown, t.NumberType> = {
    id: 'NumberType',
    idType: 'tag',
    impl: {
      type: 'fuzzer',
      func: (_, n) => {
        return n + 1;
      },
    },
  };
  const fuzzStr2: Fuzzer<string, unknown, t.StringType> = {
    id: 'StringType',
    idType: 'tag',
    impl: {
      type: 'fuzzer',
      func: (_, n) => {
        return `Bye ${n}`;
      },
    },
  };

  describe('#createRegistry', () => {
    describe('#getFuzzer', () => {
      it(`has no fuzzers`, () => {
        for (const b of types) {
          assert.strictEqual(lib.createRegistry().getFuzzer(b), null);
        }
        for (const b of unknownTypes) {
          assert.strictEqual(lib.createRegistry().getFuzzer(b), null);
        }
      });
    });

    describe('#register', () => {
      it('registers a simple fuzzer', () => {
        const r = lib.createRegistry();
        assert.strictEqual(r.register(fuzzStr1), r);
        assert.strictEqual(r.getFuzzer(t.string), fuzzStr1);
      });

      it('registers multiple distinct fuzzers sequentially', () => {
        const r = lib.createRegistry();
        assert.strictEqual(r.register(fuzzStr1), r);
        assert.strictEqual(r.register(fuzzNum), r);
        assert.strictEqual(r.getFuzzer(t.string), fuzzStr1);
        assert.strictEqual(r.getFuzzer(t.number), fuzzNum);
      });

      it('registers multiple distinct fuzzers bulk', () => {
        const r = lib.createRegistry();
        assert.strictEqual(r.register(...([fuzzStr1, fuzzNum] as Fuzzer[])), r);
        assert.strictEqual(r.getFuzzer(t.string), fuzzStr1);
        assert.strictEqual(r.getFuzzer(t.number), fuzzNum);
      });

      it('overrides 1st registration for 1 type with the 2nd across register calls', () => {
        let r = lib.createRegistry();
        assert.strictEqual(r.register(fuzzStr1), r);
        assert.strictEqual(r.register(fuzzStr2), r);
        assert.strictEqual(r.getFuzzer(t.string), fuzzStr2);

        r = lib.createRegistry();
        assert.strictEqual(r.register(fuzzStr2), r);
        assert.strictEqual(r.register(fuzzStr1), r);
        assert.strictEqual(r.getFuzzer(t.string), fuzzStr1);
      });

      it('overrides 1st registration for 1 type with the 2nd in one register call', () => {
        let r = lib.createRegistry();
        assert.strictEqual(
          r.register(fuzzStr1 as Fuzzer, fuzzStr2 as Fuzzer),
          r
        );
        assert.strictEqual(r.getFuzzer(t.string), fuzzStr2);

        r = lib.createRegistry();
        assert.strictEqual(
          r.register(fuzzStr2 as Fuzzer, fuzzStr1 as Fuzzer),
          r
        );
        assert.strictEqual(r.getFuzzer(t.string), fuzzStr1);
      });
    });
  });

  describe('#createCoreRegistry', () => {
    describe('#getFuzzer', () => {
      for (const b of types) {
        it(`has a fuzzer for \`${b.name}\` type`, () => {
          const r = lib.createCoreRegistry().getFuzzer(b);
          assert.ok(r);
          const x = r!;
          assert.ok(x.idType === 'tag' || x.idType === 'name');
          if (x.idType === 'name') {
            assert.deepStrictEqual(x.id, b.name);
          } else if ('_tag' in b) {
            const s = b as { _tag: unknown };
            assert.deepStrictEqual(x.id, s._tag);
          } else {
            assert.fail('no name or tag');
          }
        });
      }
    });

    describe('#exampleGenerator', () => {
      for (const b of types) {
        it(`can create an example generator for \`${b.name}\` type`, () => {
          const r = lib.createCoreRegistry().exampleGenerator(b);
          assert.ok(r);
        });
      }
    });
  });

  describe('#fluent', () => {
    describe('#getFuzzer', () => {
      describe('on the core registry', () => {
        for (const b of types) {
          it(`has a fuzzer for \`${b.name}\` type`, () => {
            const r = lib.fluent(lib.createCoreRegistry()).getFuzzer(b);
            assert.ok(r);
            const x = r!;
            assert.ok(x.idType === 'tag' || x.idType === 'name');
            if (x.idType === 'name') {
              assert.deepStrictEqual(x.id, b.name);
            } else if ('_tag' in b) {
              const s = b as { _tag: unknown };
              assert.deepStrictEqual(x.id, s._tag);
            } else {
              assert.fail('no name or tag');
            }
          });
        }
      });

      describe('#exampleGenerator', () => {
        describe('on the core registry', () => {
          for (const b of types) {
            it(`can create an example generator for \`${b.name}\` type`, async () => {
              const r = lib
                .fluent(lib.createCoreRegistry())
                .exampleGenerator(b);
              assert.ok(r);
            });
          }
        });
      });

      describe('#withUnknownFuzzer', () => {
        describe('on the core registry', () => {
          it(`overrides the unknown fuzzer`, () => {
            const b = t.unknown;
            const r0 = lib.createCoreRegistry();
            const r = lib
              .fluent(r0)
              .withUnknownFuzzer(t.string)
              .exampleGenerator(b);
            for (let i = 0; i < 100; i++) {
              assert.deepStrictEqual(
                typeof r.encode([i, fuzzContext({ maxRecursionHint: 10 })]),
                'string'
              );
            }
          });

          it(`overrides the underlying items in an UnknownArray`, () => {
            const b = t.UnknownArray;
            const r0 = lib.createCoreRegistry();
            const r = lib
              .fluent(r0)
              .withUnknownFuzzer(t.string)
              .exampleGenerator(b);
            for (let i = 0; i < 100; i++) {
              const e = r.encode([
                i,
                fuzzContext({ maxRecursionHint: 10 }),
              ]) as unknown[];
              e.forEach(x => assert.deepStrictEqual(typeof x, 'string'));
            }
          });
        });
      });

      describe('#withArrayFuzzer', () => {
        describe('on the core registry', () => {
          it(`overrides the array fuzzer max length`, () => {
            const b = t.array(t.number);
            const r0 = lib.createCoreRegistry();
            const r = lib
              .fluent(r0)
              .withArrayFuzzer(3)
              .exampleGenerator(b);
            for (let i = 0; i < 100; i++) {
              assert.ok(
                (r.encode([
                  i,
                  fuzzContext({ maxRecursionHint: 10 }),
                ]) as unknown[]).length <= 3
              );
            }
          });

          it(`does not affect readonly arrays`, () => {
            const b = t.readonlyArray(t.number);
            const r0 = lib.createCoreRegistry();
            const r = lib
              .fluent(r0)
              .withArrayFuzzer(3)
              .exampleGenerator(b);
            let ml = 0;
            for (let i = 0; i < 100; i++) {
              ml = Math.max(
                (r.encode([
                  i,
                  fuzzContext({ maxRecursionHint: 10 }),
                ]) as unknown[]).length,
                ml
              );
            }
            assert.ok(ml > 3);
          });

          it(`overrides apply to the underlying registry`, () => {
            const b = t.array(t.number);
            const r0 = lib.createCoreRegistry();
            lib.fluent(r0).withArrayFuzzer(3);
            const r = r0.exampleGenerator(b);
            for (let i = 0; i < 100; i++) {
              assert.ok(
                (r.encode([
                  i,
                  fuzzContext({ maxRecursionHint: 10 }),
                ]) as unknown[]).length <= 3
              );
            }
          });
        });
      });

      describe('#withRecordFuzzer', () => {
        describe('on the core registry', () => {
          it(`overrides the record fuzzer max count`, () => {
            const b = t.record(t.string, t.number);
            const r0 = lib.createCoreRegistry();
            const r = lib
              .fluent(r0)
              .withRecordFuzzer(3)
              .exampleGenerator(b);
            for (let i = 0; i < 100; i++) {
              assert.ok(
                Object.getOwnPropertyNames(
                  r.encode([i, fuzzContext({ maxRecursionHint: 10 })]) as object
                ).length <= 3
              );
            }
          });

          it(`does not affect unknown records`, () => {
            const b = t.UnknownRecord;
            const r0 = lib.createCoreRegistry();
            const r = lib
              .fluent(r0)
              .withRecordFuzzer(3)
              .exampleGenerator(b);
            let ml = 0;
            for (let i = 0; i < 100; i++) {
              ml = Math.max(
                Object.getOwnPropertyNames(
                  r.encode([i, fuzzContext({ maxRecursionHint: 10 })]) as object
                ).length,
                ml
              );
            }
            assert.ok(ml > 3);
          });

          it(`overrides apply to the underlying registry`, () => {
            const b = t.record(t.string, t.number);
            const r0 = lib.createCoreRegistry();
            lib.fluent(r0).withRecordFuzzer(3);
            const r = r0.exampleGenerator(b);
            for (let i = 0; i < 100; i++) {
              assert.ok(
                Object.getOwnPropertyNames(
                  r.encode([i, fuzzContext({ maxRecursionHint: 10 })]) as object
                ).length <= 3
              );
            }
          });
        });
      });

      describe('#withUnknownRecordFuzzer', () => {
        describe('on the core registry', () => {
          it(`overrides the unknown record fuzzer max count`, () => {
            const b = t.UnknownRecord;
            const r0 = lib.createCoreRegistry();
            const r = lib
              .fluent(r0)
              .withUnknownRecordFuzzer(3)
              .exampleGenerator(b);
            for (let i = 0; i < 100; i++) {
              assert.ok(
                Object.getOwnPropertyNames(
                  r.encode([i, fuzzContext({ maxRecursionHint: 10 })]) as object
                ).length <= 3
              );
            }
          });

          it(`does not affect records`, () => {
            const b = t.record(t.string, t.unknown);
            const r0 = lib.createCoreRegistry();
            const r = lib
              .fluent(r0)
              .withUnknownRecordFuzzer(3)
              .exampleGenerator(b);
            let ml = 0;
            for (let i = 0; i < 100; i++) {
              ml = Math.max(
                Object.getOwnPropertyNames(
                  r.encode([i, fuzzContext({ maxRecursionHint: 10 })]) as object
                ).length,
                ml
              );
            }
            assert.ok(ml > 3);
          });

          it(`overrides apply to the underlying registry`, () => {
            const b = t.UnknownRecord;
            const r0 = lib.createCoreRegistry();
            lib.fluent(r0).withUnknownRecordFuzzer(3);
            const r = r0.exampleGenerator(b);
            for (let i = 0; i < 100; i++) {
              assert.ok(
                Object.getOwnPropertyNames(
                  r.encode([i, fuzzContext({ maxRecursionHint: 10 })]) as object
                ).length <= 3
              );
            }
          });
        });
      });

      describe('#withAnyArrayFuzzer', () => {
        describe('on the core registry', () => {
          it(`overrides the any array fuzzer max length`, () => {
            const b = t.UnknownArray;
            const r0 = lib.createCoreRegistry();
            const r = lib
              .fluent(r0)
              .withAnyArrayFuzzer(3)
              .exampleGenerator(b);
            for (let i = 0; i < 100; i++) {
              assert.ok(
                (r.encode([
                  i,
                  fuzzContext({ maxRecursionHint: 10 }),
                ]) as unknown[]).length <= 3
              );
            }
          });

          it(`does not affect specific arrays`, () => {
            const b = t.array(t.number);
            const r0 = lib.createCoreRegistry();
            const r = lib
              .fluent(r0)
              .withAnyArrayFuzzer(3)
              .exampleGenerator(b);
            let ml = 0;
            for (let i = 0; i < 100; i++) {
              ml = Math.max(
                (r.encode([
                  i,
                  fuzzContext({ maxRecursionHint: 10 }),
                ]) as unknown[]).length,
                ml
              );
            }
            assert.ok(ml > 3);
          });

          it(`does not affect readonly arrays`, () => {
            const b = t.readonlyArray(t.number);
            const r0 = lib.createCoreRegistry();
            const r = lib
              .fluent(r0)
              .withAnyArrayFuzzer(3)
              .exampleGenerator(b);
            let ml = 0;
            for (let i = 0; i < 100; i++) {
              ml = Math.max(
                (r.encode([
                  i,
                  fuzzContext({ maxRecursionHint: 10 }),
                ]) as unknown[]).length,
                ml
              );
            }
            assert.ok(ml > 3);
          });
        });
      });

      describe('#withReadonlyArrayFuzzer', () => {
        describe('on the core registry', () => {
          it(`overrides the array fuzzer max length`, () => {
            const b = t.readonlyArray(t.number);
            const r0 = lib.createCoreRegistry();
            const r = lib
              .fluent(r0)
              .withReadonlyArrayFuzzer(3)
              .exampleGenerator(b);
            for (let i = 0; i < 100; i++) {
              assert.ok(
                (r.encode([
                  i,
                  fuzzContext({ maxRecursionHint: 10 }),
                ]) as unknown[]).length <= 3
              );
            }
          });

          it(`does not affect non-readonly arrays`, () => {
            const b = t.array(t.number);
            const r0 = lib.createCoreRegistry();
            const r = lib
              .fluent(r0)
              .withReadonlyArrayFuzzer(3)
              .exampleGenerator(b);
            let ml = 0;
            for (let i = 0; i < 100; i++) {
              ml = Math.max(
                (r.encode([
                  i,
                  fuzzContext({ maxRecursionHint: 10 }),
                ]) as unknown[]).length,
                ml
              );
            }
            assert.ok(ml > 3);
          });
        });
      });

      describe('#withPartialFuzzer', () => {
        describe('on the core registry', () => {
          it(`overrides the partial object extra properties`, () => {
            const b = t.partial({ a: t.number });
            const r0 = lib.createCoreRegistry();
            const r = lib
              .fluent(r0)
              .withPartialFuzzer({ b: t.string })
              .exampleGenerator(b);
            const keys = new Set<string>();
            for (let i = 0; i < 10; i++) {
              Object.keys(
                r.encode([i, fuzzContext({ maxRecursionHint: 10 })]) as object
              ).map(x => keys.add(x));
            }
            assert.deepStrictEqual(keys.size, 2);
            assert.ok(keys.has('a'));
            assert.ok(keys.has('b'));
          });
        });
      });

      describe('#withInterfaceFuzzer', () => {
        describe('on the core registry', () => {
          it(`overrides the partial object extra properties`, () => {
            const b = t.type({ a: t.number, j: t.boolean });
            const r0 = lib.createCoreRegistry();
            const r = lib
              .fluent(r0)
              .withInterfaceFuzzer({ b: t.string })
              .exampleGenerator(b);
            const keys = new Set<string>();
            for (let i = 0; i < 10; i++) {
              const ek = Object.keys(
                r.encode([i, fuzzContext({ maxRecursionHint: 10 })]) as object
              );
              assert.ok(ek.includes('a'));
              assert.ok(ek.includes('j'));
              ek.map(x => keys.add(x));
            }
            assert.deepStrictEqual(keys.size, 3);
            assert.ok(keys.has('a'));
            assert.ok(keys.has('j'));
            assert.ok(keys.has('b'));
          });
        });
      });
    });
  });
});
