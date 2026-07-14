<?php

namespace App\Domain\Utils;

use kornrunner\Keccak;
use Mdanter\Ecc\Curves\CurveFactory;
use Mdanter\Ecc\Curves\SecgCurve;
use Mdanter\Ecc\Math\ConstantTimeMath;

/**
 * Web3 Ethereum personal_sign verifier using EC point recovery.
 * Implements ECDSA public key recovery from a signature to derive
 * the Ethereum wallet address and compare with the claimed address.
 */
class Web3SignatureVerifier
{
    public static function verify(string $address, string $message, string $signature): bool
    {
        try {
            // Normalize wallet address to lowercase
            $address = strtolower($address);

            // Strip '0x' prefix from signature if present
            if (str_starts_with($signature, '0x')) {
                $signature = substr($signature, 2);
            }

            if (strlen($signature) !== 130) {
                return false;
            }

            // Split signature into r, s, v components
            $r = substr($signature, 0, 64);
            $s = substr($signature, 64, 64);
            $v = hexdec(substr($signature, 128, 2));

            // Normalize v: Ethereum personal_sign returns v as 27 or 28
            if ($v >= 27) {
                $v -= 27;
            }

            if ($v !== 0 && $v !== 1) {
                return false;
            }

            // Build the Ethereum Signed Message prefix hash
            if (preg_match('/^0x[a-fA-F0-9]{64}$/', $message)) {
                $binMessage = hex2bin(substr($message, 2));
                $ethMessage = "\x19Ethereum Signed Message:\n32" . $binMessage;
            } else {
                $ethMessage = "\x19Ethereum Signed Message:\n" . strlen($message) . $message;
            }
            $msgHash = Keccak::hash($ethMessage, 256);

            // Recover the public key from signature using EC point recovery
            $recoveredAddress = self::recoverAddress($msgHash, $r, $s, $v);

            return $recoveredAddress !== null && strtolower($recoveredAddress) === $address;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Recover Ethereum wallet address from a Keccak-256 message hash and ECDSA signature components.
     */
    private static function recoverAddress(string $msgHash, string $r, string $s, int $v): ?string
    {
        try {
            $math = new ConstantTimeMath();
            $generator = CurveFactory::getGeneratorByName(SecgCurve::NAME_SECP_256K1);
            $curve     = $generator->getCurve();
            $order     = $generator->getOrder();

            $rGmp  = gmp_init($r, 16);
            $sGmp  = gmp_init($s, 16);
            $zGmp  = gmp_init($msgHash, 16);
            $prime = $curve->getPrime();

            // R point X-coordinate = r (mod p)
            $x = $math->mod($rGmp, $prime);

            // Compute y^2 = x^3 + ax + b (mod p), for secp256k1: a=0, b=7
            $y2 = $math->mod(
                $math->add(
                    $math->add(
                        $math->pow($x, 3),
                        $math->mul($curve->getA(), $x)
                    ),
                    $curve->getB()
                ),
                $prime
            );

            // Compute y = sqrt(y^2) mod p  (secp256k1 prime ≡ 3 mod 4, so y = y2^((p+1)/4) mod p)
            $exp = gmp_div_q(gmp_add($prime, gmp_init(1)), gmp_init(4));
            $y   = gmp_powm($y2, $exp, $prime);

            // Choose the correct y parity based on recovery bit v
            $yParity = gmp_intval($math->mod($y, gmp_init(2)));
            if ($yParity !== $v) {
                $y = $math->mod($math->sub($prime, $y), $prime);
            }

            // Build the R point on the curve
            $R = $curve->getPoint($x, $y, $order);

            // Recover public key: Q = r^-1 * (s*R - z*G)
            $rInv = gmp_invert($rGmp, $order);

            // s * R
            $sR = $R->mul($sGmp);

            // z * G
            $zG = $generator->mul($zGmp);

            // sR - zG  ⟹  sR + (-zG)
            $negZG = $curve->getPoint(
                $zG->getX(),
                $math->mod($math->sub($prime, $zG->getY()), $prime),
                $order
            );

            $Q = $sR->add($negZG)->mul($rInv);

            // Serialize uncompressed public key (04 || x || y) to hex
            $xHex = str_pad(gmp_strval($Q->getX(), 16), 64, '0', STR_PAD_LEFT);
            $yHex = str_pad(gmp_strval($Q->getY(), 16), 64, '0', STR_PAD_LEFT);
            $pubKeyHex  = '04' . $xHex . $yHex;

            // Strip the 04 prefix, then keccak256-hash the 64-byte (x,y) pair
            $pubKeyBin  = pack('H*', substr($pubKeyHex, 2));
            $pubKeyHash = Keccak::hash($pubKeyBin, 256);

            // Ethereum address = last 20 bytes of the hash
            return '0x' . substr($pubKeyHash, -40);
        } catch (\Exception $e) {
            return null;
        }
    }
}
