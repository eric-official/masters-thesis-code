<a id="readme-top"></a>



# Master's Thesis Code


<!-- ABOUT THE PROJECT -->
## About The Project

<p align="right">(<a href="#readme-top">back to top</a>)</p>

Nowadays, many animal species are under threat of extencition. Environmental
organizations take actions to combat the extinction of wildlife animals but are
often hindered by limited human and financial resources. Crowdsourcing offers
a solution by enabling citizens to contribute to wildlife conservation efforts by
providing aerial wildlife images. However, traditional crowdsourcing platforms
suffer from issues such as lack of trust, transparency, and vulnerability to failures.
Utilizing blockchain technology solves these issues, but raises the challenges
of maintaining data quality of contributions and hiding the location of wildlife
from poachers.  

To address these challenges, a blockchain-based crowdsourcing platform
for wildlife conservation is introduced, in which the quality of crowdsourced
contributions is controlled and the location of wildlife animals is preserved. The
proposed quality-control mechanism consists of three approaches. All provided
contributed aerial wildlife images by participants are evaluated by reviewers in a
data quality assessment. Contributing to crowdsourcing platforms increases the
reputation of participants and reviewers, who are incentivized to collect high-
quality aerial wildlife images through a reward policy. Additionally, the location
is kept confidential during the whole crowdsourcing process with a twofold
application of cryptographic techniques. Exchanging the location between the
participant and the reviewer in the data quality assessment is based on an
asymmetric encryption scheme (AES). Confidential verifications of the location
by researchers or the general public are enabled with zero-knowledge, succinct,
non-interactive argument of knowledge (zk-SNARKs).  

The proposed blockchain-based crowdsourcing platform demonstrates real-
world applicability. Validations of the quality-control mechanism illustrated
that honest participants are allowed to become reviewers, malicious participants
get banned, and the contributions are rewarded according to their data quality.
Performance tests showed a short running time for the crowdsourcing process
on commodity hardware. Scalability was confirmed by comparing user and
contribution volumes to existing wildlife conservation platforms, indicating the
platform can handle similar volumes. A security analysis found no security
risks in the implementation, and the zk-SNARK location verification successfully
preserved the confidentiality of contribution locations.


<!-- GETTING STARTED -->
## Getting Started

This is an example of how you may give instructions on setting up your project locally.
To get a local copy up and running follow these simple example steps.


### Prerequisites

* `NPM`: Install NPM by running the following command in your terminal:
  ```sh
  npm install npm@latest -g
  ```
* `Node`: To download the latest version of Node, see [here](https://nodejs.org/en/download/).
* `Circom`: To install Circom, follow the instructions [here](https://docs.circom.io/getting-started/installation).
* `Akord`: Create an Akord account to fetch images [here](https://akord.com).


### Installation

1. Open the terminal and change the directory to folder in which you would like to create this project.
2. Clone the repository.
   ```sh
   git clone https://github.com/eric-official/masters-thesis-code.git
   ```
3. Change the directory to the repository folder.
   ```sh
   cd masters-thesis-code
   ```
4. Install the NPM packages.
   ```sh
   npm install
   ```
5. Install the SnarkJS package.
   ```sh
   npm install -g snarkjs@latest
   ```
6. Create an `.env` file in the repository folder and add your Akord credentials.
   ```sh
   AKORD_EMAIL = <YOUR-EMAIL>
   AKORD_PASSWORD = "<YOUR-PASSWORD>"
   ```
7. Compile the smart contracts
    ```sh
    npx hardhat compile
    ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Usage

To run the script, execute the following command in the terminal:
```sh
node scripts/script.js Standard Subsequent 2 1 False
```

The script takes the following arguments:
1. The type of the simulation: `Standard` or `Rounds`.
2. The type of he participant selection: `Subsequent` or `Alternating`.
3. The number of users (must be equal to or greater than 2).
4. The number of contracts (must be equal to or greater than 1).
5. The flag to indicate whether the random location verification of the evaluation in the master's thesis should be executed. If `True`, the number of users must be equal to 2 and the number of contributions must be equal to 1.


## Security Audit of the Smart Contract

To audit the smart contract CSPlatform.sol, execute the following steps:

1. Open the remappings.json file
2. Change the directory `/Users/ericnaser/...` to your local path for the SD59x18.sol file of the prb-math library.
3. Run the following command in the terminal:
    ```sh
    myth analyze contracts/CSPlatform.sol --solc-json remappings.json --max-depth 20
    ```

<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>


