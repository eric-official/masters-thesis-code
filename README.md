<a id="readme-top"></a>



# Master's Thesis Code

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#license">License</a></li>
  </ol>
</details>



<!-- ABOUT THE PROJECT -->
## About The Project

<p align="right">(<a href="#readme-top">back to top</a>)</p>


### Built With

This section should list any major frameworks/libraries used to bootstrap your project.

* [![Solidity][solidity-shield]][solidity-url]
* [![Hardhat][hardhat-shield]][hardhat-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>



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


## Security Audit of the Smart Contract

To audit the smart contract CSPlatform.sol, execute the following steps:

1. Open the remappings.json file
2. Change the directory `/Users/ericnaser/...` to your local path for the SD59x18.sol file of the prb-math library.
3. Run the following command in the terminal:
    ```sh
    myth analyze contracts/CSPlatform.sol --solc-json remappings.json --max-depth 15
    ```

<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- MARKDOWN LINKS & IMAGES -->
[solidity-shield]: https://img.shields.io/badge/Solidity-e6e6e6?style=for-the-badge&logo=solidity&logoColor=black
[solidity-url]: https://soliditylang.org/
[hardhat-shield]: https://img.shields.io/npm/v/hardhat.svg?style=flat-square
[hardhat-url]: https://hardhat.org/