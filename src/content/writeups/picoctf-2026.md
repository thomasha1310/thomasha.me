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

The challenge provides a script (`encrypt.py`) that implements a textbook version of the [NTRU public-key cryptosystem](https://en.wikipedia.org/wiki/NTRUEncrypt). We are given a list of public parameters $N = 48$, $p = 3$, and $q = 509$, along with the public key $\mathbf{h}$ and a list of encrypted ciphertext chunks.

At its core, NTRU essentially encrypts data using matrix and vector multiplication, where the polynomials $\mathbf{f}$ and $\mathbf{g}$ (represented as vectors and together forming the private key) are of sufficiently high degree that a brute-force attack (usually with lattice reduction) is infeasible.

### Mathematical Reasoning

More specifically, the algorithm relies on the NP-hardness of the [shortest vector problem](https://en.wikipedia.org/wiki/Lattice_problem). Given a sufficiently large $N$, it becomes difficult to find $\mathbf{f}$. However, by choosing $N = 48$, the script produces a 96-dimensional lattice, making it trivial for [standard basis reduction algorithms](https://en.wikipedia.org/wiki/Lenstra%E2%80%93Lenstra%E2%80%93Lov%C3%A1sz_lattice_basis_reduction_algorithm) to find the shortest vector.

The challenge generates the public key using the equation

$$
\mathbf{h} \equiv p \cdot \mathbf{f}^{-1} \cdot \mathbf{g} \pmod{q}
$$

Ciphertext blocks are generated by encoding the message into polynomials $\mathbf{m}$ with coefficients in $[-p/2, p/2]$ and evaluating:

$$
\mathbf{c} \equiv \mathbf{r} \cdot \mathbf{h} + \mathbf{m} \pmod{q}
$$

where $\mathbf{r}$ is a random polynomial. When attacking the cryptosystem, we can ignore $\mathbf{r}$; you will see why momentarily.

Taking the public key generation equation, we can multiply both sides by $\mathbf{f}$ and represent the modulo $q$ as subtracting by some unknown multiple $\mathbf{k} \cdot q$:

$$
\mathbf{f} \cdot \mathbf{h} - \mathbf{k} \cdot q = p \cdot \mathbf{g}
$$

where $\mathbf{k}$ is a polynomial. We then produce a lattice matrix $\mathbf{B}$:

$$
\mathbf{B} = \begin{pmatrix}
I & \mathbf{M}_\mathbf{h} \\
0 & qI
\end{pmatrix}
$$

where $\mathbf{M}_\mathbf{h}$ is the $N \times N$ [circulant matrix](https://en.wikipedia.org/wiki/Circulant_matrix) representing multiplication by $\mathbf{h}$. More precisely, $\mathbf{f} \cdot \mathbf{M}_\mathbf{h}$ produces a vector of coefficients that is identical to the coefficients obtained by multiplying the polynomials $\mathbf{f}$ and $\mathbf{h}$.

At this point, we have two unknowns to solve for: $\mathbf{f}$ and $\mathbf{k}$. If we multiply the vector $(\mathbf{f}, -\mathbf{k})$ by $\mathbf{B}$, we obtain:

$$
\begin{align*}
(\mathbf{f}, -\mathbf{k}) \begin{pmatrix}
I & \mathbf{M}_\mathbf{h} \\
0 & qI
\end{pmatrix} &= (\mathbf{f}, \mathbf{f} \cdot \mathbf{M}_\mathbf{h} - \mathbf{k} \cdot q)\\
&= (\mathbf{f}, \mathbf{f} \cdot \mathbf{h} - \mathbf{k} \cdot q) \\
&= (\mathbf{f}, p \cdot \mathbf{g})
\end{align*}
$$

Thus, we have confirmed that the vector $(\mathbf{f}, p \cdot \mathbf{g})$ is contained on the lattice represented by $\mathbf{B}$. Because the challenge author generated $\mathbf{f}$ and $\mathbf{g}$ using very small ternary coefficients (strictly $-1, 0,$ and $1$), this target vector is incredibly short. By applying a basis reduction algorithm to $\mathbf{B}$, we will find $(\mathbf{f}, p \cdot \mathbf{g})$ and therefore can extract $\mathbf{f}$ from its first $N$ components.

Once we have the private key polynomial $\mathbf{f}$, decrypting the ciphertext $\mathbf{c}$ is straightforward. First, we multiply the ciphertext by $\mathbf{f}$ modulo $q$:

$$
\mathbf{a} \equiv \mathbf{f} \cdot \mathbf{c} \equiv \mathbf{f} \cdot (\mathbf{r} \cdot \mathbf{h} + \mathbf{m}) \pmod{q}
$$

By substituting the public key definition $\mathbf{h} \equiv p \cdot \mathbf{f}^{-1} \cdot \mathbf{g} \pmod{q}$, the equation simplifies:

$$
\mathbf{a} \equiv \mathbf{f} \cdot \mathbf{r} \cdot (p \cdot \mathbf{f}^{-1} \cdot \mathbf{g}) + \mathbf{f} \cdot \mathbf{m} \equiv p \cdot \mathbf{r} \cdot \mathbf{g} + \mathbf{f} \cdot \mathbf{m} \pmod{q}
$$

Recall that the coefficients of $\mathbf{m}$ are chosen in the interval $[-p/2, p/2]$. Thus, we must shift the coefficients of $\mathbf{a}$ into $[-q/2, q/2]$ to recover the original message. Additionally, consider that the coefficients of each polynomial used in the cryptosystem are small compared to $q$, implying that reducing modulo $q$ does not actually alter the coefficients. Therefore, we can omit the modulo $q$:

$$
\mathbf{a} = p \cdot \mathbf{r} \cdot \mathbf{g} + \mathbf{f} \cdot \mathbf{m}
$$

and then reduce modulo $p$:

$$
\begin{align*}
\mathbf{b} &= \mathbf{a} \pmod{p}\\
           &= \mathbf{f} \cdot \mathbf{m} \pmod{p}
\end{align*}
$$

Finally, we multiply by the inverse of $\mathbf{f}$ modulo $p$.

### Exploit

We use SageMath to do the math:

```python
from sage.all import *

N = 48
p = 3
q = 509
h_list = [83, 440, 124, 416, 371, 240, 320, 408, 130, 337, 399, 169, 81, 354, 221, 446, 309, 97, 148, 403, 506, 163, 195, 379, 91, 354, 24, 11, 72, 264, 343, 442, 319, 10, 418, 114, 140, 68, 116, 102, 507, 347, 65, 35, 7, 273, 290, 175]
ct_list = [[266, 103, 183, 99, 223, 103, 1, 377, 148, 10, 152, 500, 110, 255, 445, 248, 419, 283, 163, 260, 241, 433, 441, 481, 166, 159, 355, 153, 270, 357, 163, 481, 52, 498, 96, 444, 433, 1, 266, 176, 263, 264, 98, 111, 28, 280, 193, 363], [482, 430, 145, 33, 17, 508, 275, 281, 114, 483, 458, 143, 277, 276, 186, 492, 277, 176, 415, 123, 274, 239, 195, 163, 275, 82, 497, 364, 494, 113, 161, 187, 229, 495, 85, 169, 58, 496, 300, 421, 191, 21, 214, 377, 488, 439, 327, 169], [197, 239, 59, 404, 152, 444, 314, 168, 193, 326, 390, 51, 139, 296, 4, 357, 64, 476, 12, 313, 207, 401, 78, 492, 401, 75, 399, 95, 27, 178, 422, 242, 105, 125, 287, 11, 93, 397, 71, 495, 275, 57, 322, 413, 363, 489, 54, 45], [304, 172, 179, 19, 250, 416, 209, 0, 431, 123, 387, 404, 102, 474, 445, 174, 229, 464, 425, 204, 233, 426, 362, 179, 252, 377, 208, 87, 451, 334, 257, 214, 222, 239, 415, 66, 299, 469, 215, 283, 87, 444, 35, 451, 141, 185, 404, 269], [287, 283, 174, 167, 453, 203, 271, 389, 278, 264, 483, 181, 453, 147, 385, 254, 338, 330, 46, 77, 229, 247, 323, 97, 323, 232, 74, 99, 364, 165, 240, 222, 405, 107, 482, 508, 174, 97, 86, 397, 468, 353, 377, 56, 407, 203, 296, 119], [280, 434, 358, 332, 155, 154, 267, 179, 181, 383, 435, 233, 157, 250, 39, 181, 37, 52, 179, 361, 132, 254, 20, 183, 99, 393, 274, 401, 144, 178, 423, 187, 44, 376, 186, 256, 485, 377, 222, 433, 87, 470, 451, 153, 216, 248, 23, 117]]

R = PolynomialRing(ZZ, 'x')
x = R.gen()
R_modq = PolynomialRing(Integers(q), 'x').quotient(x**N - 1, 'xbar')
R_modp = PolynomialRing(Integers(p), 'x').quotient(x**N - 1, 'xbar')

h_poly = R(h_list)
M_h = Matrix(ZZ, N, N)
for i in range(N):
    shifted = (h_poly * (x**i)) % (x**N - 1)
    coeffs = shifted.list() + [0] * (N - len(shifted.list()))
    M_h[i] = coeffs

B = block_matrix(ZZ, [
    [matrix.identity(N), M_h],
    [matrix.zero(N), q * matrix.identity(N)]
])

L = B.LLL()
f = R(list(L[0][:N]))
f_p_inv = R_modp(f)**-1

binary_str = ""
for c_chunk in ct_list:
    c = R_modq(c_chunk)

    a_modq = R_modq(f) * c

    coeffs = a_modq.lift().list()

    centered = [((int(coeff) + q//2) % q) - q//2 for coeff in coeffs]
    centered += [0] * (N - len(centered))

    m = R_modp(centered) * f_p_inv
    m_coeffs = list(m.lift().list()) + [0] * (N - len(m.lift().list()))
    binary_str += "".join(str(int(bit % p)) for bit in m_coeffs)

flag = "".join([chr(int(binary_str[i:i+8], 2)) for i in range(0, len(binary_str), 8)])
print(flag)
```

### Notes

In this challenge, I made the assumption that the shortest vector we found was equal to $\mathbf{f}$, which turned out to be correct. We can, however, strengthen this assumption by calculating the Euclidean norm of the target vector $(\mathbf{f}, p \cdot \mathbf{g})$ and comparing it to the Gaussian heuristic (which estimates the shortest vector in an $n$-dimensional lattice $\mathbf{L}$):

$$
||(\mathbf{f}, p \cdot \mathbf{g})|| \leq \sqrt{N \cdot (1^2) + N \cdot (p^2)} = \sqrt{480} \approx 21.9
$$

In contrast, the Gaussian heuristic:

$$
\sqrt{\frac{n}{2\pi e}} \cdot (\det \mathbf{L})^{1/n} = \sqrt{\frac{96}{2\pi e}} \cdot (\det \mathbf{B})^{1/96} \approx 53.5
$$

Since the Euclidean norm of the target vector is significantly less than the Gaussian heuristic, we can be reasonably confident that a basis reduction algorithm (which technically provides an _estimate_ of the shortest vector) will most likely find the _actual_ shortest vector, which in our case contains $\mathbf{f}$.

When reviewing this challenge after the event ended, I found [these slides](https://www.ias.edu/sites/default/files/PCMISlidesX1.pdf) incredibly helpful.

---

## outcome
