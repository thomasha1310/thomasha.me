---
title: "picoctf 2026"
description: "competing as sharon cyber. top 3% team globally."
date: "mar 2026"
tags:
    - "ctfs"
    - "cryptography"
links:
    - label: "our team"
      url: "https://learn.cylabacademy.org/teams/17496"
---

## debrief

Our team closed out picoCTF 2026 with 13,500 of 14,500 available points, placing us in the top 3% of teams globally. We struggled to solve the most difficult reverse engineering and web exploitation challenges ([JITFP](https://learn.cylabacademy.org/library/737) and [paper-2](https://learn.cylabacademy.org/library/726), respectively), but we were able to solve every other challenge in the competition.

I found two cryptography challenges particularly interesting. [One](https://learn.cylabacademy.org/library/702) makes use of a sloppy weakness in a particular implementation of RSA, and the [other](https://learn.cylabacademy.org/library/711) involved abusing lattice-based cryptography.

---

## ClusterRSA

### Reconnaisance

In any [RSA](https://en.wikipedia.org/wiki/RSA_cryptosystem) challenge, the first step is checking $N$ for weaknesses. We are directly given $N$ and $e$:

```
n = 8749002899132047699790752490331099938058737706735201354674975134719667510377522805717156720453193651
e = 65537
ct = 3891662771105467488888140657249806558204248580982414398721303729411975827561400201060615350757604497
```

Our $N$ is given as a 100-digit decimal number, corresponding to a roughly 330-bit binary representation, and we immediately notice that this is likely not a standard 2048-bit modulus. Passing $N$ into public factorization tools like [FactorDB](http://www.factordb.com/), we find that $N$ is indeed fully factored, but as 4 25-digit prime numbers rather than the standard $p$ and $q$:

```
p1 = 9671406556917033397931773
p2 = 9671406556917033398314601
p3 = 9671406556917033398439721
p4 = 9671406556917033398454847
```

### Mathematical Reasoning

Traditional RSA cryptosystems rely on a large modulus $N = p \times q$, where $p$ and $q$ are two large, distinct prime numbers (typically 1024 bits each). By using an $N$ over 80% smaller than normal than the standard 2048-bit modulus, the given cryptosystem is inherently weakened.

In addition, the challenge uses a multi-prime architecture ($N = p_1 \times p_2 \times p_3 \times p_4$), reducing the bit-length of each individual prime to roughly 80 bits. More importantly, these four primes are clustered, meaning the variance between them is negligibly small. Given four clustered prime factors, we can estimate that each factor will be roughly around the fourth root of $N$.

By starting with the search term $s = \sqrt[4]{N} \approx 9671406556917033398285235$, we can run a brute force search for factors of $N$.

Fortunately, since FactorDB already has $N$'s factorization, we don't need to do the brute forcing ourselves.

### Exploit

Once $N$ is factored, constructing the exploit is easy. Rather than using the standard Euler's totient function $\phi(N) = (p - 1)(q - 1)$, we compute $\phi(N)$ as the product of one less than each of the prime components:

$$
\phi(N) = \prod_{i = 1}^{4}(p_i - 1)
$$

Given $\phi(N)$, calculating the private key is trivial:

$$
d \equiv e^{-1} \pmod{\phi(N)}
$$

We wrote a Python script to automate the decryption:

```python
from Crypto.Util.number import inverse, long_to_bytes
from math import prod

def crack_multiprime_rsa(factors, e, c):
    n = prod(factors)

    phi = 1
    for p in factors:
        phi *= (p - 1)

    d = inverse(e, phi)
    m = pow(c, d, n)
    return long_to_bytes(m)

factors = [
    9671406556917033397931773,
    9671406556917033398314601,
    9671406556917033398439721,
    9671406556917033398454847
]
e = 65537
c = 3891662771105467488888140657249806558204248580982414398721303729411975827561400201060615350757604497

flag = crack_multiprime_rsa(factors, e, c)
print(flag.decode())
```

---

## Not TRUe

### Reconnaisance

### Mathematical Reasoning

### Exploit

---

## outcome
